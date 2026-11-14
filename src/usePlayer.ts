import { useEffect, useRef, useState } from "react";
import { nextTrack, type Repeat, type Track } from "./music";
function saved() {
  try {
    return JSON.parse(localStorage.getItem("localbeat-player") ?? "{}") as {
      current?: string;
      shuffle?: boolean;
      repeat?: Repeat;
    };
  } catch {
    return {};
  }
}
const initial = saved();
export function usePlayer(tracks: Track[], report: (message: string) => void) {
  const [audio] = useState(() => new Audio());
  const [current, setCurrent] = useState<string | null>(
    initial.current ?? null,
  );
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(initial.shuffle === true);
  const [repeat, setRepeat] = useState<Repeat>(
    ["off", "all", "one"].includes(initial.repeat ?? "")
      ? initial.repeat!
      : "off",
  );
  const url = useRef<string | null>(null);
  const selected = useRef<string | null>(null);
  const failed = useRef(new Set<string>());
  const state = useRef({ tracks, current, shuffle, repeat, report });
  state.current = { tracks, current, shuffle, repeat, report };

  function load(id: string) {
    const track = state.current.tracks.find((item) => item.id === id);
    if (!track) return false;
    audio.pause();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(track.blob);
    selected.current = id;
    state.current.current = id;
    audio.src = url.current;
    setCurrent(id);
    setPosition(0);
    setDuration(track.duration || 0);
    if ("mediaSession" in navigator && "MediaMetadata" in window) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: "LocalBeat",
        artwork: [
          {
            src: new URL(
              `${import.meta.env.BASE_URL}icon-512.png`,
              location.origin,
            ).href,
            sizes: "512x512",
            type: "image/png",
          },
        ],
      });
    }
    return true;
  }
  async function play() {
    try {
      await audio.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && error.name === "NotAllowedError")
        report("Tap play to start listening.");
      // Decode/source failures are handled once by the audio error event.
      else if (!audio.error)
        report("Playback could not start. Try this track again.");
    }
  }
  function select(id: string) {
    failed.current.clear();
    if (load(id)) void play();
  }
  function move(direction: 1 | -1, ended = false) {
    const s = state.current;
    if (direction === -1 && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const id = nextTrack(
      s.tracks.map((t) => t.id),
      selected.current,
      direction,
      s.shuffle,
      s.repeat,
      ended,
    );
    if (id && load(id)) void play();
  }
  function toggle() {
    if (!audio.paused) {
      audio.pause();
      return;
    }
    failed.current.clear();
    if (!selected.current) {
      const first = state.current.tracks[0];
      if (!first || !load(first.id)) return;
    }
    void play();
  }
  function seek(seconds: number) {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(audio.duration, seconds));
      setPosition(audio.currentTime);
    }
  }
  const actions = useRef({ move, toggle, play, seek, load });
  actions.current = { move, toggle, play, seek, load };

  useEffect(() => {
    const updatePosition = () => {
      setPosition(audio.currentTime);
      if (
        "mediaSession" in navigator &&
        Number.isFinite(audio.duration) &&
        audio.duration > 0
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: Math.min(audio.currentTime, audio.duration),
          });
        } catch {
          /* Optional browser capability. */
        }
      }
    };
    const metadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      updatePosition();
    };
    const playback = () => {
      setPlaying(!audio.paused);
      if ("mediaSession" in navigator)
        navigator.mediaSession.playbackState = audio.paused
          ? "paused"
          : "playing";
    };
    const ended = () => actions.current.move(1, true);
    const error = () => {
      if (selected.current) failed.current.add(selected.current);
      state.current.report(
        "This track cannot be played. Trying the next available track.",
      );
      const available = state.current.tracks.filter(
        (t) => !failed.current.has(t.id),
      );
      if (available.length && actions.current.load(available[0].id))
        void actions.current.play();
      else {
        setPlaying(false);
        state.current.report(
          "No playable tracks found. Try importing a different audio format.",
        );
      }
    };
    const events: [string, () => void][] = [
      ["timeupdate", updatePosition],
      ["loadedmetadata", metadata],
      ["durationchange", metadata],
      ["play", playback],
      ["pause", playback],
      ["ended", ended],
      ["error", error],
    ];
    events.forEach(([name, handler]) => audio.addEventListener(name, handler));
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      [
        "play",
        () => {
          if (selected.current) void actions.current.play();
          else actions.current.toggle();
        },
      ],
      ["pause", () => audio.pause()],
      ["previoustrack", () => actions.current.move(-1)],
      ["nexttrack", () => actions.current.move(1)],
      [
        "seekto",
        (d) => {
          if (d.seekTime !== undefined) actions.current.seek(d.seekTime);
        },
      ],
      [
        "seekbackward",
        (d) => actions.current.seek(audio.currentTime - (d.seekOffset ?? 10)),
      ],
      [
        "seekforward",
        (d) => actions.current.seek(audio.currentTime + (d.seekOffset ?? 10)),
      ],
    ];
    if ("mediaSession" in navigator)
      handlers.forEach(([action, handler]) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch {
          /* Not all actions supported. */
        }
      });
    return () => {
      events.forEach(([name, handler]) =>
        audio.removeEventListener(name, handler),
      );
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (url.current) URL.revokeObjectURL(url.current);
      if ("mediaSession" in navigator) {
        handlers.forEach(([action]) => {
          try {
            navigator.mediaSession.setActionHandler(action, null);
          } catch {
            /* Unsupported action. */
          }
        });
        navigator.mediaSession.metadata = null;
      }
    };
  }, [audio]);

  useEffect(() => {
    if (tracks.length && !selected.current) {
      const restored = tracks.find((t) => t.id === current) ?? tracks[0];
      actions.current.load(restored.id);
    } else if (
      selected.current &&
      !tracks.some((t) => t.id === selected.current)
    ) {
      const wasPlaying = !audio.paused;
      audio.pause();
      if (tracks.length) {
        actions.current.load(tracks[0].id);
        if (wasPlaying) void actions.current.play();
      } else {
        audio.removeAttribute("src");
        audio.load();
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = null;
        selected.current = null;
        setCurrent(null);
        setPosition(0);
        setDuration(0);
        if ("mediaSession" in navigator) {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = "none";
        }
      }
    }
  }, [tracks, audio, current]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "localbeat-player",
        JSON.stringify({ current, shuffle, repeat }),
      );
    } catch {
      /* Playback still works with storage disabled. */
    }
  }, [current, shuffle, repeat]);
  return {
    current,
    playing,
    position,
    duration,
    shuffle,
    repeat,
    setShuffle,
    setRepeat,
    select,
    toggle,
    seek,
    previous: () => move(-1),
    next: () => move(1),
  };
}
