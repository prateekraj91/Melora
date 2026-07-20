# 🎵 Songside

An AI-powered desktop companion for Spotify.

Songside displays synchronized lyrics in a floating overlay and uses AI to explain the meaning of the song you're listening to in real time.

---

## ✨ Features

- 🎵 Live Spotify song detection
- 🎤 Synchronized lyrics
- 🤖 AI-powered lyric explanations
- 🪟 Floating always-on-top overlay
- 🎯 Click-through mode
- 📌 System tray integration

---

## 🚀 Installation

Clone the repository:

```bash
git clone https://github.com/prateekraj91/Melora.git
cd Melora/songside
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

---

## 🔐 Environment Variables

Create a `.env` file inside the `songside` directory.

Example:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
GEMINI_KEY=your_gemini_api_key
LLM_PROVIDER=gemini
```

> Configure your Spotify application with the redirect URI:
>
> `http://127.0.0.1:8888/callback`

---

## 📦 Build

### macOS

```bash
npm run build:mac
```

### Windows

```bash
npm run build:win
```

### Linux

```bash
npm run build:linux
```

---

## 🛠 Tech Stack

- Electron
- React
- Vite
- Spotify Web API
- Gemini API

---

## 📄 License

MIT License

---

Part of the **Melora** project.