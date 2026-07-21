# 🎵 Songside

An AI-powered desktop companion for Spotify that displays synchronized lyrics in a floating overlay and explains song meanings in real time while you listen.

---

## 📸 Screenshots

### Songside running on Spotify

<img width="1470" alt="Songside Hero" src="YOUR_FIRST_IMAGE_LINK">

### Floating overlay while coding

<img width="1470" alt="Songside VS Code" src="YOUR_SECOND_IMAGE_LINK">

### AI lyric explanation

<img width="373" alt="Songside AI Explanation" src="YOUR_THIRD_IMAGE_LINK">

### Artist page integration

<img width="1470" alt="Songside Artist Page" src="YOUR_FOURTH_IMAGE_LINK">

---

## ✨ Features

- 🎵 Live Spotify song detection
- 🎤 Synchronized lyrics overlay
- 🤖 AI-powered lyric explanations
- 🪟 Floating always-on-top window
- 🎯 Click-through mode
- 📌 Menu bar integration
- 🎨 Album artwork color extraction

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
LLM_PROVIDER=gemini
```

Configure your Spotify Developer application with the redirect URI:

```
http://127.0.0.1:8888/callback
```

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
- TypeScript
- Vite
- Spotify Web API
- Google Gemini API

---

## 🗺️ Roadmap

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
