<div align="center">

# Melora

**AI-powered desktop companions for music.**

[![Platform](https://img.shields.io/badge/platform-macOS-black?logo=apple)](https://www.apple.com/macos/)
[![Electron](https://img.shields.io/badge/built%20with-Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

</div>

**Songside** is the first app in Melora. It sits as a floating overlay next to whatever you're playing on Spotify, scrolls the lyrics line by line in time with the track, and explains what a line actually means when you hover over it.

I built it because I kept pausing music to go look up what a lyric meant, and by the time I got back the moment had passed.

## Screenshots

### Songside running on Spotify
<img width="1470" alt="Songside Hero" src="https://github.com/user-attachments/assets/5b7b9dca-cf6d-4c77-b697-a43052bb8cc4" />

### Floating overlay while coding
<img width="1470" alt="Songside VS Code" src="https://github.com/user-attachments/assets/7e603f9d-a290-47dc-be75-363057f7d09e" />

### AI lyric explanation
<img width="373" alt="Songside AI Explanation" src="https://github.com/user-attachments/assets/0160ffdc-25ab-4d68-bfc1-b6a5d799813d" />

### Artist page integration
<img width="1470" alt="Songside Artist Page" src="https://github.com/user-attachments/assets/c403bb55-6914-49f8-b06b-e874888dac4e" />

## Features

- Detects the currently playing Spotify track and follows playback position
- Time-synced lyrics in an always-on-top overlay, sourced from [LRCLIB](https://lrclib.net)
- Hover any line for an AI explanation of the metaphor, reference, or context
- Click any lyric line to seek playback to that moment
- Overlay appears when music plays and hides when you pause or quit Spotify
- Click-through mode so the overlay never blocks the window behind it
- Overlay colors picked from the album art
- Menu bar tray icon with show/hide, launch-at-login, and reconnect — no dock clutter
- Falls back gracefully when a track has no synced lyrics

## Getting Started

You'll need Node.js 18+, a **Spotify Premium** account, and a Spotify app from the
[developer dashboard](https://developer.spotify.com/dashboard).

> Premium is required — the Spotify playback endpoints return `403` on free accounts.

```bash
git clone https://github.com/prateekraj91/Melora.git
cd Melora/songside
npm install
npm run dev
```

In your Spotify app settings:

1. Add `http://127.0.0.1:8888/callback` as a redirect URI.
2. Go to **User Management** and add your own Spotify account (full name + the email
   on your account). Apps in development mode only allow explicitly registered users,
   up to 5 — without this you'll get `403: user may not be registered`.

Then create `songside/.env` (copy `.env.example` to start):

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
GEMINI_KEY=your_gemini_api_key
LLM_PROVIDER=ollama
```

Auth uses the PKCE flow, so there's no client secret to store. `LLM_PROVIDER` can
be `gemini` or `ollama` — whichever you don't pick is used as the fallback, so a
local Ollama install can cover you when the API is unreachable. Ollama is the
suggested default: new Google Cloud projects sometimes have a Gemini free-tier
quota of zero, which returns `429` on every request.

To build a macOS app bundle:

```bash
npm run build:mac
```

## Structure

```
Melora/
└── songside/                  # the Electron app
    ├── src/
    │   ├── main/              # Spotify auth, lyrics, LLM, tray, color
    │   ├── preload/
    │   └── renderer/          # React overlay
    ├── resources/
    └── package.json
```

## Built With

Electron · React · Vite · Tailwind CSS · Spotify Web API · LRCLIB · Gemini / Ollama

## Roadmap

- [ ] Signed and notarized `.dmg` release
- [ ] Windows and Linux builds
- [ ] Theme and typography customization
- [ ] Lyric translation
- [ ] Conversational follow-ups about a song

## Contributing

Issues and pull requests are welcome. If Songside breaks on your setup, open an
issue with your macOS version and what you were playing — lyric coverage varies a
lot by track, and that context helps.

## License

MIT — Prateek Raj
