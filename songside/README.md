# 🎵 Songside

An AI-powered desktop companion for Spotify that displays synchronized lyrics in a floating overlay and explains song meanings in real time while you listen.

## 📸 Screenshots

### Songside running on Spotify
<img width="1470" alt="Songside Hero" src="https://github.com/user-attachments/assets/5b7b9dca-cf6d-4c77-b697-a43052bb8cc4" />

### Floating overlay while coding
<img width="1470" alt="Songside VS Code" src="https://github.com/user-attachments/assets/7e603f9d-a290-47dc-be75-363057f7d09e" />

### AI lyric explanation
<img width="373" alt="Songside AI Explanation" src="https://github.com/user-attachments/assets/0160ffdc-25ab-4d68-bfc1-b6a5d799813d" />

### Artist page integration
<img width="1470" alt="Songside Artist Page" src="https://github.com/user-attachments/assets/c403bb55-6914-49f8-b06b-e874888dac4e" />

---

## ✨ Features

- 🎵 Live Spotify song detection
- 🎤 Synchronized lyrics overlay (via LRCLIB)
- 🤖 AI-powered lyric explanations (Gemini or local Ollama)
- ⏩ Click a lyric line to seek playback to that moment
- 🪟 Floating always-on-top window
- 👀 Auto show on play, auto hide on pause or when Spotify quits
- 🎯 Click-through mode
- 📌 Menu bar integration with launch-at-login
- 🎨 Album artwork color extraction

---

## 🚀 Installation

Requires Node.js 18+ and a **Spotify Premium** account (the playback endpoints return `403` on free accounts).

Clone the repository:

```bash
git clone https://github.com/prateekraj91/Melora.git
cd Melora/songside
```

Install dependencies:

```bash
npm install
```

Run the application:

```bash
npm run dev
```

---

## 🔐 Environment Variables

Create a `.env` file inside the `songside` directory.

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
GEMINI_KEY=your_gemini_api_key
LLM_PROVIDER=ollama
```

`LLM_PROVIDER` accepts `gemini` or `ollama`; the other is used automatically as a
fallback. Ollama is suggested as the default — new Google Cloud projects sometimes
have a Gemini free-tier quota of zero, which returns `429` on every request.

Configure your Spotify Developer application:

1. Add the redirect URI:

```
http://127.0.0.1:8888/callback
```

2. Under **Settings → User Management**, add your own Spotify account (full name +
   the email on your account). Development-mode apps only allow explicitly registered
   users, up to 5. Without this, playback requests fail with
   `403: user may not be registered`.

---

## 📦 Build

### macOS

```bash
npm run build:mac
```

Windows and Linux builds are on the roadmap and not supported yet.

---

## 🛠 Tech Stack

- Electron
- React
- JavaScript (JSX)
- Vite
- Tailwind CSS
- Spotify Web API (PKCE)
- LRCLIB
- Google Gemini API / Ollama (local)

---

## 🗺️ Roadmap

- Windows and Linux builds
- AI conversations about songs
- More LLM providers
- Better lyric synchronization
- Theme customization
- Translation support

---

## ⚠️ Disclaimer

Songside is an independent project and is not affiliated with or endorsed by Spotify.

---

## 📄 License

MIT License.

---

Built as part of the **Melora** project.
