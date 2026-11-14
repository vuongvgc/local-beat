# LocalBeat

A small, private offline music player for your own files. React + TypeScript + Vite, plain CSS, IndexedDB and one HTML audio playback instance. No accounts, uploads, analytics, external fonts or backend.

- Multi-file import, duplicate detection (filename + size + last modified), search and sorting.
- Play, pause, seek, previous/next, shuffle and repeat off/all/one.
- Restores your library, selected track and modes without autoplay.
- Media Session controls for compatible lock screens, notifications and Bluetooth headsets.
- Installable PWA with a precached app shell. Audio stays in IndexedDB, separate from service worker caches.
- Updates are offered explicitly, so playback is not interrupted by automatic reloads.

## Development

Node 22.13+ and npm:

```sh
npm install
npm run dev
npm test
npm run check
npm run build
npm run preview
```

Open the printed URL under `/local-beat/`. Service workers are generated for production builds; use `npm run preview` to check offline behavior.

## GitHub Pages

Push `main` to `https://github.com/vuongvgc/local-beat`. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. The included workflow checks TypeScript, runs tests, builds and publishes `dist` with official Pages actions. If an environment approval is required, approve the `github-pages` deployment in Actions.

Expected URL: https://vuongvgc.github.io/local-beat/

Vite base, manifest scope/start URL and service worker all use `/local-beat/`.

## Android and offline use

Open the deployed site in Chrome while online and let the first load finish. Use the app’s Install button when offered, or Chrome’s **⋮ → Add to home screen → Install**. Import music with **Add music**. Files never leave your device. Importing requests persistent storage where supported, but browsers may decline it.

Offline refresh works after the service worker has installed and taken control (reload once after the first visit). Music is scoped to this browser/profile/origin: clearing website data, uninstalling with data removal, private browsing, or storage eviction can erase it. Keep your original files. You may need to import again when switching browser or moving from a local preview to the deployed app.

Audio format support depends on the browser and codec, not just the extension. Invalid files are skipped; decode failures advance to another track, stopping when every track fails. Titles/artists are inferred from `Artist - Title.ext`; embedded ID3 tags and cover art are not parsed. Shuffle chooses another track each time; it is not a precomputed queue. Previous restarts a track after three seconds; otherwise it selects the previous track.

Background playback uses standard HTMLAudioElement and Media Session APIs. It cannot be guaranteed on every Android device: battery optimization, memory pressure, force closing, browser policies and Bluetooth behavior can interrupt playback. Service workers do not play or keep audio alive. No CPU/wake-lock hacks are used.

## Verification

`npm test` covers queue boundaries, repeat modes, shuffle selection, identity and filename/time parsing. TypeScript and production build are checked separately.

Browser checks: multi-file import and duplicates; play/pause/resume; next/previous; seek; automatic advancement; all repeat modes; shuffle; delete the active track; refresh persistence; unsupported file; offline refresh; manifest and service worker; Media Session handlers. Storage failure can be exercised by blocking site storage or exceeding its quota.

A physical Android device is required to verify install prompts, lock-screen/Bluetooth controls and background playback over time. Desktop checks cannot establish those results.

API references: [Media Session](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API), [Vite Pages deployment](https://vite.dev/guide/static-deploy).
