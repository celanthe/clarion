# Clarion

**Your agents have things to say. Now they have a voice to say them with.**

Self-hosted TTS proxy and voice manager. Audition voices against your agent's actual dialogue, save the one that fits, and pipe their responses through it — in the browser or from the terminal.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rinoliver)

---

## Why give your agent a voice?

If you're building AI agents with distinct characters — a cautious security analyst, a sharp product lead, a warm UX researcher — they probably already have different ways of speaking. Clarion makes that audible.

- **Characters stay consistent.** Your security analyst always sounds like your security analyst. Different agents sound different from each other.
- **Demos and podcasts.** Record multi-agent conversations where each voice is distinct. Play back an agent's response in real time.
- **It changes how you work with them.** Hearing a response lands differently than reading it.

---

## What it does

- **Audition voices** — paste your agent's actual dialogue, hear each voice read it, find the one that fits
- **Save agent profiles** — one agent uses Kokoro `bm_george` at 1.0×, another uses Edge `en-GB-SoniaNeural` — saved, exported, shareable as JSON
- **Three TTS backends**: Edge TTS (zero config, free), Kokoro (self-hosted, natural), Piper (self-hosted, lightweight)
- **Terminal integration** — pipe your agent's responses through their voice from the CLI

---

## Quickstart

### UI only (Edge TTS, no setup needed)

```sh
npm install
npm run dev
# → http://localhost:5173
```

### With server (required for Kokoro/Piper)

```sh
cd server
npm install
npm run dev        # Cloudflare Worker via wrangler
# → http://localhost:8787
```

Or with Docker (Kokoro included):

```sh
docker-compose up
# Kokoro at :8880, Clarion server at :8080
```

---

## Voice audition

The fastest way to find the right voice:

1. Open the **Audition** tab
2. Paste your agent's characteristic dialogue — a few lines they'd actually say
3. Select a backend (Kokoro for the most natural voices)
4. Click ▶ next to each voice to hear it read your text
5. Click **Use this voice** → name the agent → saved

Short, characteristic sentences work best. If your agent has a distinctive way of phrasing things, use that.

---

## CLI *(coming soon)*

Pipe your agent's terminal output through their voice directly from the command line. Planned:

```sh
# Speak as a saved agent
echo "The pattern holds." | node cli/speak.js --agent aria

# Or directly
node cli/speak.js "Running diagnostics now." --backend kokoro --voice bm_george
```

Agent profiles will export from the UI and be stored at `~/.config/clarion/agents.json`.

---

## API

```
POST /speak
{ "text": "Hello.", "backend": "edge", "voice": "en-GB-RyanNeural", "speed": 1.0 }
→ audio/mpeg

GET /voices?backend=edge|kokoro|piper
→ { voices: [{ id, label, lang, gender }] }

GET /health
→ { edge: "up", kokoro: "up|down|unconfigured", piper: "up|down|unconfigured" }
```

---

## Backends

| Backend | Config needed | Quality | Voices |
|---------|--------------|---------|--------|
| **Edge TTS** | None | Good | 18+ Neural voices (US, UK, AU, IE, CA, IN) |
| **Kokoro** | `KOKORO_SERVER=http://...` | Excellent | 11 voices (US + UK English) |
| **Piper** | `PIPER_SERVER=http://...` | OK | 6 voices (US + UK English) |

**Edge TTS** uses Microsoft's neural voices — no API key, no server, works immediately. Good quality, slight Microsoft TTS character to it. Note: this uses an undocumented endpoint that isn't officially supported for third-party use — if you need long-term stability, run Kokoro instead.

**Kokoro** is the best option if you're willing to run a server. It's a local ONNX model that produces genuinely natural speech — less "AI voice", more character. Runs on CPU with no GPU required. Use `docker-compose up` to get it running in one command.

**Piper** is lightweight and fully offline. Lower quality than Kokoro but very fast and minimal resource usage.

---

## Security notes

Clarion is designed for personal, self-hosted use. A few things to know before exposing it on a network:

- **Set an API key** if your server is reachable beyond localhost. Set `API_KEY=your-secret` on the server, then enter the same key in Clarion's Server config panel. All requests will require `Authorization: Bearer <key>`.
- **CORS is open (`*`) by default.** Set `ALLOWED_ORIGIN=https://your-domain.com` to restrict which origins can reach the server.
- **The Kokoro local server (`kokoro-server.py`) binds to `127.0.0.1` by default**, so it's only reachable from localhost. Set `KOKORO_HOST=0.0.0.0` only if you need it accessible across a trusted network.
- For public deployments, put Cloudflare Access or an nginx auth proxy in front rather than relying on the API key alone.

---

## Deploy

**Cloudflare Worker** (recommended for Edge TTS + proxy):
```sh
cd server
wrangler deploy
```

Set `KOKORO_SERVER` and `PIPER_SERVER` as Worker secrets:
```sh
wrangler secret put KOKORO_SERVER
wrangler secret put PIPER_SERVER
```

**Docker Compose** (for Kokoro self-hosters):
```sh
docker-compose up
```

---

## Credits

Built by [celanthe](https://github.com/celanthe) · Art & design by [Zabethy](https://zabethy.com) · in progress

Built on [Erika Flowers](https://github.com/erikaflowers)' [Investiture](https://zerovector.design/investiture) framework · inspired by [Everbloom Reader](https://everbloomreader.com) by [celanthe](https://github.com/celanthe) and [Zabethy](https://zabethy.com)
