import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  AudioLines,
  ArrowUpRight,
  Check,
  ChevronDown,
  Disc3,
  Download,
  Headphones,
  ListMusic,
  LoaderCircle,
  Music2,
  Moon,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Search,
  ShieldCheck,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { registerSW } from "virtual:pwa-register";
import { fileIdentity, fileLabels, formatTime, type Track } from "./music";
import { musicStorage } from "./storage";
import { readDuration } from "./audioMetadata";
import { usePlayer } from "./usePlayer";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("added");
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const playerDialog = useRef<HTMLDialogElement>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [sleepConfigOpen, setSleepConfigOpen] = useState(false);
  const importLock = useRef(false);
  const player = usePlayer(tracks, setNotice);
  const active = tracks.find((track) => track.id === player.current);
  useEffect(() => {
    let mounted = true;
    musicStorage
      .all()
      .then((items) => {
        if (mounted) {
          setTracks(items.sort((a, b) => b.added - a.added));
          setStorageReady(true);
        }
      })
      .catch(() => {
        if (mounted)
          setNotice(
            "Music storage is unavailable. Allow site storage, then reload LocalBeat.",
          );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    const connectivity = () => setOnline(navigator.onLine);
    const prompt = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    const installed = () => setInstall(null);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    window.addEventListener("beforeinstallprompt", prompt);
    window.addEventListener("appinstalled", installed);
    const refresh = registerSW({
      onNeedRefresh: () => {
        if (mounted) setUpdate(() => () => refresh(true));
      },
      onRegisterError: () => {
        if (mounted)
          setNotice("Offline setup failed. Reconnect and reload to try again.");
      },
    });
    return () => {
      mounted = false;
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      window.removeEventListener("beforeinstallprompt", prompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  useEffect(() => {
    const dialog = playerDialog.current;
    if (!dialog) return;
    if (playerOpen && active) {
      dialog.showModal();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        dialog.close();
        document.body.style.overflow = previousOverflow;
      };
    }
    dialog.close();
  }, [playerOpen, Boolean(active)]);
  useEffect(() => {
    if (!active) setPlayerOpen(false);
  }, [active]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 741px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setPlayerOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  async function importMusic(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length || importLock.current) return;
    importLock.current = true;
    setImporting(true);
    const known = new Set(tracks.map((t) => t.id));
    let added = 0,
      duplicates = 0,
      invalid = 0;
    let storageError = "";
    for (const file of files) {
      if (
        !(
          file.type.startsWith("audio/") ||
          /\.(mp3|m4a|aac|wav|ogg|flac|opus|webm)$/i.test(file.name)
        ) ||
        !file.size
      ) {
        invalid++;
        continue;
      }
      const id = fileIdentity(file);
      if (known.has(id)) {
        duplicates++;
        continue;
      }
      let duration: number;
      try {
        duration = await readDuration(file);
      } catch {
        invalid++;
        continue;
      }
      const track: Track = {
        id,
        ...fileLabels(file.name),
        name: file.name,
        size: file.size,
        added: Date.now() + added,
        duration,
        blob: file,
      };
      try {
        await musicStorage.put(track);
        known.add(id);
        added++;
        setTracks((previous) => [...previous, track]);
      } catch (error) {
        storageError =
          error instanceof DOMException && error.name === "QuotaExceededError"
            ? "Storage is full. Remove some tracks to free space."
            : "Could not save music. Check your browser’s storage settings.";
        break;
      }
    }
    setNotice(
      [
        added ? `Added ${added} ${added === 1 ? "track" : "tracks"}.` : "",
        duplicates ? `${duplicates} already in your library.` : "",
        invalid ? `${invalid} invalid or unsupported files skipped.` : "",
        storageError,
      ]
        .filter(Boolean)
        .join(" "),
    );
    setImporting(false);
    importLock.current = false;
    if (added) void navigator.storage?.persist?.().catch(() => false);
  }
  async function remove(track: Track) {
    try {
      await musicStorage.remove(track.id);
      setTracks((previous) => previous.filter((t) => t.id !== track.id));
    } catch {
      setNotice("Could not remove this track. Please try again.");
    }
  }
  const visible = tracks
    .filter((t) =>
      `${t.title} ${t.artist}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title" ? a.title.localeCompare(b.title) : b.added - a.added,
    );
  const addMusic = () => picker.current?.click();
  const playerPanel = (
    <section className="player-panel" aria-label="Music player">
      <div className="panel-heading">
        <span>
          <span className="live-dot" /> NOW PLAYING
        </span>
        <Headphones size={17} />
      </div>
      <div className={`artwork ${player.playing ? "is-playing" : ""}`}>
        <div className="artwork-grain" />
        <span className="artwork-top">LOCALBEAT ORIGINALS</span>
        <div className="vinyl">
          <div className="vinyl-label">
            <AudioLines size={37} />
            <span>LB — 001</span>
          </div>
        </div>
        <div className="artwork-bottom">
          <span>
            GOOD MUSIC.
            <br />
            NO DISTRACTIONS.
          </span>
          <ArrowUpRight size={26} />
        </div>
      </div>
      <div className="track-info">
        <span className="tiny-label">
          {active ? "FROM YOUR LIBRARY" : "THE STAGE IS YOURS"}
        </span>
        <h2>{active?.title ?? "Find your rhythm"}</h2>
        <p>{active?.artist ?? "Add a little music to your day"}</p>
      </div>
      <div className="timeline">
        <input
          aria-label="Seek playback"
          type="range"
          min="0"
          max={player.duration || 0}
          step="0.1"
          value={Math.min(player.position, player.duration || 0)}
          disabled={!active || !player.duration}
          onChange={(e) => player.seek(Number(e.target.value))}
          style={
            {
              "--progress": `${player.duration ? (player.position / player.duration) * 100 : 0}%`,
            } as React.CSSProperties
          }
        />
        <div>
          <span>{formatTime(player.position)}</span>
          <span>{formatTime(player.duration)}</span>
        </div>
      </div>
      <div className="playback-controls">
        <button
          className={`icon-button mode ${player.shuffle ? "active" : ""}`}
          aria-label="Shuffle"
          aria-pressed={player.shuffle}
          onClick={() => player.setShuffle(!player.shuffle)}
        >
          <Shuffle size={20} />
        </button>
        <button
          className="icon-button"
          aria-label="Previous track"
          disabled={!active}
          onClick={player.previous}
        >
          <SkipBack size={23} fill="currentColor" />
        </button>
        <button
          className="play-button"
          aria-label={player.playing ? "Pause" : "Play"}
          disabled={!tracks.length}
          onClick={player.toggle}
        >
          {player.playing ? (
            <Pause size={28} fill="currentColor" />
          ) : (
            <Play size={28} fill="currentColor" />
          )}
        </button>
        <button
          className="icon-button"
          aria-label="Next track"
          disabled={!active}
          onClick={player.next}
        >
          <SkipForward size={23} fill="currentColor" />
        </button>
        <button
          className={`icon-button mode ${player.repeat !== "off" ? "active" : ""}`}
          aria-label={`Repeat: ${player.repeat}`}
          title={`Repeat: ${player.repeat}`}
          onClick={() =>
            player.setRepeat(
              player.repeat === "off"
                ? "all"
                : player.repeat === "all"
                  ? "one"
                  : "off",
            )
          }
        >
          {player.repeat === "one" ? (
            <Repeat1 size={21} />
          ) : (
            <Repeat size={21} />
          )}
        </button>
      </div>
      <div className={`sleep-timer ${player.sleepRemaining !== null ? "is-active" : ""}`}>
        <div className="sleep-timer-heading">
          <span><Moon size={16} /> Sleep timer</span>
          <button
            className="sleep-countdown"
            aria-label="Configure sleep timer"
            aria-expanded={sleepConfigOpen}
            onClick={() => setSleepConfigOpen(!sleepConfigOpen)}
          >
            {player.sleepRemaining === null ? "Off" : formatTime(player.sleepRemaining)}
            <ChevronDown size={14} />
          </button>
        </div>
        {sleepConfigOpen && (
          <>
            <p>
              {player.sleepRemaining === null
                ? "Drift off. We’ll pause the music for you."
                : "Music will pause when the timer ends."}
            </p>
            <div className="sleep-timer-options" role="group" aria-label="Sleep timer duration">
              {[15, 30, 45, 60].map((minutes) => (
                <button
                  key={minutes}
                  disabled={!active}
                  aria-label={`Set sleep timer for ${minutes} minutes`}
                  onClick={() => {
                    player.setSleepTimer(minutes);
                    setSleepConfigOpen(false);
                  }}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            {player.sleepRemaining !== null && (
              <button className="sleep-cancel" onClick={() => {
                player.setSleepTimer(null);
                setSleepConfigOpen(false);
              }}>
                <X size={14} /> Cancel timer
              </button>
            )}
          </>
        )}
      </div>
      <div className="player-footer">
        <span className={player.playing ? "equalizer playing" : "equalizer"}>
          <i />
          <i />
          <i />
          <i />
        </span>
        {player.playing
          ? "Just you and the music"
          : active
            ? "Ready when you are"
            : "A little quiet, for now"}
      </div>
    </section>
  );
  return (
    <div className={`app-shell ${active ? "has-track" : ""}`}>
      <header className="header">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="LocalBeat home"
        >
          <span className="brand-icon">
            <AudioLines size={25} />
          </span>
          Local<span>Beat</span>
          <span className="brand-dot" />
        </a>
        <div className="header-actions">
          <span className="connection">
            <span className={online ? "status-dot" : "status-dot offline"} />
            {online ? "Made for offline" : "You’re offline"}
          </span>
          {install && (
            <button
              className="button ghost install"
              onClick={async () => {
                await install.prompt();
                const choice = await install.userChoice;
                if (choice.outcome === "accepted") setInstall(null);
              }}
            >
              <Download size={16} />
              Install app
            </button>
          )}
          <button
            className="button primary"
            onClick={addMusic}
            disabled={importing || !storageReady}
          >
            {importing ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Plus size={18} />
            )}
            <span>{importing ? "Importing…" : "Add music"}</span>
          </button>
        </div>
      </header>
      <input
        ref={picker}
        className="file-input"
        type="file"
        multiple
        accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus,.webm"
        onChange={importMusic}
        aria-label="Choose music files"
      />
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span /> YOUR OWN LITTLE SOUNDTRACK
            </div>
            <h1>
              Your music.
              <br className="mobile-break" /> Your space<span>.</span>
            </h1>
            <p>All the songs you love. Wherever you go.</p>
          </div>
          <div className="private-note">
            <ShieldCheck size={18} />
            <span>
              Always private.
              <br />
              <strong>Entirely yours.</strong>
            </span>
          </div>
        </section>
        <div className="workspace">
          <div className="desktop-player">{playerPanel}</div>
          <section className="library-panel" aria-label="Music library">
            <div className="library-heading">
              <div>
                <h2>
                  Your library <span>{tracks.length}</span>
                </h2>
                <p>A collection that sounds like you.</p>
              </div>
              <ListMusic size={22} />
            </div>
            <div
              className={`library-toolbar ${!tracks.length ? "empty-toolbar" : ""}`}
            >
              <label className="search">
                <Search size={17} />
                <input
                  placeholder="Find your next favorite…"
                  aria-label="Search library"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="clear-search"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X size={15} />
                  </button>
                )}
              </label>
              <label className="sort">
                <select
                  aria-label="Sort library"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="added">Recently added</option>
                  <option value="title">Title A–Z</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
            {loading ? (
              <div className="empty-state">
                <LoaderCircle className="spin" />
                <h3>Opening your library…</h3>
              </div>
            ) : !tracks.length ? (
              <div className="empty-state">
                <div className="empty-illustration">
                  <span className="orbit orbit-one" />
                  <span className="orbit orbit-two" />
                  <span className="floating-note note-one">♪</span>
                  <span className="floating-note note-two">♫</span>
                  <div>
                    <Music2 size={38} strokeWidth={1.4} />
                  </div>
                </div>
                <span className="tiny-label">MAKE YOURSELF AT HOME</span>
                <h3>Your favorites belong here.</h3>
                <p>
                  Bring your music along. Add songs from your device
                  <br className="desktop-break" /> and make this space your own.
                </p>
                <button
                  className="button primary"
                  onClick={addMusic}
                  disabled={importing || !storageReady}
                >
                  <Plus size={18} />
                  Add your first tracks
                </button>
                <span className="formats">MP3, M4A, WAV, FLAC & more</span>
              </div>
            ) : (
              <>
                <div className="list-columns">
                  <span>TRACK</span>
                  <span>DURATION</span>
                </div>
                <div className="track-list">
                  {visible.map((track, index) => (
                    <div
                      key={track.id}
                      className={`track-row ${track.id === active?.id ? "selected" : ""}`}
                    >
                      <button
                        className="track-select"
                        onClick={() =>
                          track.id === active?.id
                            ? player.toggle()
                            : player.select(track.id)
                        }
                        aria-label={`${track.id === active?.id && player.playing ? "Pause" : "Play"} ${track.title}`}
                      >
                        <span className={`track-cover cover-${index % 4}`}>
                          {track.id === active?.id && player.playing ? (
                            <AudioLines size={20} />
                          ) : (
                            <Music2 size={20} />
                          )}
                        </span>
                        <span className="track-text">
                          <strong>{track.title}</strong>
                          <span>{track.artist}</span>
                        </span>
                        <span className="track-duration">
                          {track.id === active?.id
                            ? formatTime(player.duration)
                            : track.duration
                              ? formatTime(track.duration)
                              : "—"}
                        </span>
                      </button>
                      <button
                        className="icon-button remove"
                        aria-label={`Remove ${track.title}`}
                        title="Remove from library"
                        onClick={() => void remove(track)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {!visible.length && (
                    <div className="no-results">
                      <Search size={25} />
                      <h3>No tracks found</h3>
                      <p>Try another title or artist.</p>
                    </div>
                  )}
                </div>
                <div className="library-summary">
                  <Check size={14} />
                  {tracks.length} {tracks.length === 1 ? "track" : "tracks"}{" "}
                  saved on this device
                  <span>
                    {(
                      tracks.reduce((sum, t) => sum + t.size, 0) / 1048576
                    ).toFixed(1)}{" "}
                    MB
                  </span>
                </div>
              </>
            )}
            <div className="local-note">
              <span className="local-note-icon">
                <WifiOff size={19} />
              </span>
              <div>
                <strong>Great music. Zero connection required.</strong>
                <p>
                  Your files stay on your device. No uploads, no accounts, no
                  ads.
                </p>
              </div>
              <ShieldCheck size={20} />
            </div>
          </section>
        </div>
        <footer className="footer">
          <span>
            <Disc3 size={15} /> BUILT FOR THE LOVE OF MUSIC
          </span>
          <span>Less noise. More you.</span>
        </footer>
      </main>
      {active && (
        <nav className="mini-player" aria-label="Playback controls">
          <button
            className="mini-track"
            onClick={() => setPlayerOpen(true)}
            aria-label={`Open player: ${active.title}`}
            aria-haspopup="dialog"
          >
            <span className="mini-cover">
              <AudioLines size={22} />
            </span>
            <span className="mini-track-text">
              <strong>{active.title}</strong>
              <span>{active.artist}</span>
            </span>
          </button>
          <button
            className="mini-play icon-button"
            onClick={player.toggle}
            aria-label={player.playing ? "Pause" : "Play"}
          >
            {player.playing ? (
              <Pause size={23} fill="currentColor" />
            ) : (
              <Play size={23} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button"
            onClick={player.next}
            aria-label="Next track"
          >
            <SkipForward size={22} fill="currentColor" />
          </button>
          <div className="mini-progress" aria-hidden="true">
            <span
              style={{
                width: `${player.duration ? (player.position / player.duration) * 100 : 0}%`,
              }}
            />
          </div>
        </nav>
      )}
      <dialog
        ref={playerDialog}
        className="player-dialog"
        aria-label="Now playing"
        onClose={() => setPlayerOpen(false)}
      >
        <button
          className="close-player"
          onClick={() => setPlayerOpen(false)}
          autoFocus
        >
          <ChevronDown size={22} />
          <span>Back to library</span>
        </button>
        {playerPanel}
      </dialog>
      {notice && (
        <div className="toast" role="status">
          <Music2 size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {update && (
        <div className="update-banner" role="status">
          <span>A fresh version is ready.</span>
          <button
            onClick={() => {
              player.playing && player.toggle();
              void update();
            }}
          >
            Update & reload
          </button>
          <button aria-label="Dismiss update" onClick={() => setUpdate(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
