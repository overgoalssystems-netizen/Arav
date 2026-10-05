# Sarvam Vaani 🪔

A **voice-first AI assistant** for every Indian language, built on
[Sarvam AI](https://docs.sarvam.ai). Speak into the mic and your words appear
**live** on screen; the assistant answers in the same language and can speak
its reply back.

```
🎙  speak  →  live transcript  →  Sarvam-105B  →  Bulbul voice reply
     (Saaras STT)                   (chat)          (TTS)
```

---

## Features

| | |
|---|---|
| **Live transcription** | Tap the mic and watch your speech turn into text in real time (segmented Saaras STT). |
| **All Indian languages** | 22 Indian languages + English in the picker, with auto-detect. |
| **Spoken replies** | The assistant reads its answer aloud via Bulbul v3 (11 languages), with a mute toggle. |
| **Streaming answers** | Replies stream in token-by-token — no waiting for the full text. |
| **Unique UI** | Aurora-glass design, an animated voice orb, and a listening waveform. |
| **Demo mode** | Runs with no API key so you can see the whole interface immediately. |

---

## Quick start

```bash
# 1. get a key from https://dashboard.sarvam.ai
# 2. put it in backend/.env
cp backend/.env.example backend/.env
#   ...then edit backend/.env and set SARVAM_API_KEY=...

# 3. run everything
bash run.sh
```

Then open **http://localhost:8000** in Chrome or Edge (best microphone support).

> Prefer to do it by hand?
> ```bash
> pip install -r backend/requirements.txt
> uvicorn app:app --app-dir backend --host 0.0.0.0 --port 8000
> ```

---

## Project structure

```
sarvam-voice-ai/
├── backend/
│   ├── app.py             # FastAPI gateway to the Sarvam APIs + serves the UI
│   ├── requirements.txt
│   └── .env.example       # copy to .env and add your key
├── frontend/
│   ├── index.html         # layout
│   ├── styles.css         # aurora-glass design system
│   └── app.js             # mic, live transcription, streaming chat, TTS
├── run.sh                 # one-command launcher (run: bash run.sh)
├── render.yaml            # Render blueprint (one-click deploy)
├── Dockerfile             # for Fly.io / Cloud Run / VPS
├── Procfile               # for Railway / Heroku
└── README.md
```

The backend keeps your API key **server-side** — the browser never sees it.

---

## How it works

1. **Speech → text.** The mic records in short segments (~2.2 s). Each segment is
   POSTed to `/api/stt`, which calls Sarvam's `saaras:v3` model, and the returned
   text is appended to the live transcript.
2. **Text → answer.** Your message is sent to `/api/chat`, which streams from
   `sarvam-105b` and relays tokens to the browser as Server-Sent Events.
3. **Answer → speech.** `/api/tts` calls `bulbul:v3` and returns base64 WAV, which
   the browser plays automatically (toggle with the 🔊 button).

### Backend API

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/config` | Languages, speakers, models, demo flag |
| `GET`  | `/api/health` | Health + demo status |
| `POST` | `/api/chat` | Streaming chat (`sarvam-105b`) |
| `POST` | `/api/stt` | Speech-to-text (`saaras:v3`) |
| `POST` | `/api/tts` | Text-to-speech (`bulbul:v3`) |
| `POST` | `/api/translate` | Text translation (`mayura:v1`) |

---

## Configuration

Edit `backend/.env`:

```ini
SARVAM_API_KEY=your_key
CHAT_MODEL=sarvam-105b      # or sarvam-105b-conversations
STT_MODEL=saaras:v3         # or saaras:v4
TTS_MODEL=bulbul:v3
```

In the app's **Settings** drawer you can also switch the chat model, the voice
(speaker), the recognition mode (transcribe / code-mix / transliterate /
translate), and the live-segment length.

---

## Deploying (GitHub → Render)

Render runs the whole app as **one service** — FastAPI serves the frontend too,
so there is nothing extra to host. It also gives you **HTTPS**, which the
microphone requires.

**1. Push to GitHub**
```bash
cd sarvam-voice-ai
git init && git add . && git commit -m "Sarvam Vaani"
git branch -M main
git remote add origin https://github.com/<you>/sarvam-voice-ai.git
git push -u origin main
```
`backend/.env` is git-ignored, so your key is never committed.

**2. Create the service on Render**
- *New +* → **Blueprint** (it reads `render.yaml`), **or** *New +* → **Web Service** and set:
  - Build command: `pip install -r backend/requirements.txt`
  - Start command: `uvicorn app:app --app-dir backend --host 0.0.0.0 --port $PORT`

**3. Add your key** — Render dashboard → your service → *Environment* → add
`SARVAM_API_KEY` = your key → save (it redeploys automatically).

**4. Open the Render URL** on your phone or laptop. Done.

> **Free-tier note:** Render's free web services sleep after ~15 minutes of
> inactivity, so the first request after a nap takes ~30–60 s to wake up.
> Upgrade to an always-on instance for instant response.

### Other hosts

The same repo runs anywhere that supports Python or Docker:

- **Railway / Heroku** — the included `Procfile` is picked up automatically.
- **Fly.io / Google Cloud Run / a VPS** — use the included `Dockerfile`.
- **Netlify / Vercel** — static-only; they can host the *frontend* but not this
  Python backend, so use them only in a split setup.

---

## Notes & tips

- **Browser:** Chrome or Edge give the best mic support (`MediaRecorder` + WebM).
- **Microphone needs HTTPS or localhost** — that's a browser rule, not ours.
- **Bulbul voices 11 languages** (Hindi, Bengali, Tamil, Telugu, Gujarati,
  Kannada, Malayalam, Marathi, Punjabi, Odia, English). For the other languages
  the assistant still transcribes and answers; it just won't auto-speak.
- **Long recordings:** the REST speech-to-text endpoint caps each request at 30 s.
  The segmented recorder stays well under that. For continuous streaming, Sarvam
  also offers a realtime WebSocket STT endpoint — a natural next upgrade.
- **No key yet?** The app starts in *demo mode* so you can click around; add the
  key and restart to go live.

---

## Roadmap ideas

- Realtime WebSocket STT for word-by-word streaming (no segments).
- Barge-in: stop speaking when the user starts talking.
- Conversation memory / saved threads.
- Document Q&A via Sarvam Vision.

Built with FastAPI + vanilla JS — no build step, no bundler.
