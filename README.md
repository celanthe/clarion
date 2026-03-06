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

## CLI

Pipe your agent's responses through their voice from the terminal.

```sh
# Speak as a saved agent (by ID or name)
echo "The pattern holds." | node cli/speak.js --agent aria

# Direct voice selection
node cli/speak.js "Running diagnostics." --backend kokoro --voice bm_george

# List your saved agents
node cli/speak.js --list-agents

# Save as audio file
node cli/speak.js "Hello." --voice en-GB-RyanNeural > hello.mp3
```

**Setup:**
1. Export agents from the Clarion UI — **Export** on any agent card, or **Export all** in the footer
2. Save the JSON to `~/.config/clarion/agents.json`
3. Set `CLARION_SERVER` env var, or add `{ "server": "http://..." }` to `~/.config/clarion/config.json`
4. Pipe output to a player: `| mpv -`, `| ffplay -nodisp -autoexit -`, `| afplay` (macOS)

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

Clarion is designed for personal, self-hosted use. If you're deploying it beyond localhost, read this before you do.

### API key authentication

Set `API_KEY=your-secret` in your server environment. All requests will then require `Authorization: Bearer <key>`.

- **Node server** (`npm start`): set `API_KEY` in your shell env or `.env` file — it's injected into the Hono app automatically.
- **Cloudflare Worker**: use `wrangler secret put API_KEY` — do not put secrets in `wrangler.toml`.
- In the Clarion UI, enter your key under **Server → API key**. It is stored in browser `localStorage` — accessible to any JavaScript running on the same origin. Use the UI only from a browser you trust, on a machine you control.

### HTTPS

Bearer tokens are sent in plaintext. **Always use HTTPS for non-localhost deployments.** Without TLS, any network observer can steal the API key and make requests in your name.

- For the Node server, terminate TLS at a reverse proxy (nginx, Caddy, Traefik).
- For the Cloudflare Worker, TLS is handled by Cloudflare automatically.

### CORS

CORS is open (`*`) by default. Set `ALLOWED_ORIGIN=https://your-domain.com` to restrict which browser origins can call the server. This affects both API responses and audio responses.

### Local backend servers

`kokoro-server.py` and `piper-server.py` bind to `127.0.0.1` by default — only reachable from the same machine. Set `KOKORO_HOST` / `PIPER_HOST` to `0.0.0.0` only if you need them on a LAN or VPN you trust.

### For public-facing deployments

The Bearer token is a convenience mechanism, not a full auth layer. For anything exposed on the public internet, add Cloudflare Access or an nginx `auth_basic` / JWT proxy in front. Don't rely solely on the API key.

### What Clarion does NOT do

- No usage-based APIs are called, so there are no surprise bills. Edge TTS uses Microsoft's internal endpoint (no key, no quota). Kokoro and Piper are self-hosted.
- No telemetry or analytics are collected. Nothing is sent anywhere except your configured TTS backends.
- No user data is stored server-side. Agent profiles live in browser `localStorage` only.

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

## Running Piper locally

Piper is a lightweight offline ONNX TTS engine. `piper-server.py` wraps the piper CLI and exposes a `/v1/audio/speech` endpoint.

```sh
# 1. Install the piper binary
#    → https://github.com/rhasspy/piper/releases
#    Extract and put `piper` on your PATH

# 2. Download voice models (into ./piper-models/)
mkdir piper-models
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json
# Repeat for: kathleen, lessac, ryan (US) and alan, jenny_dioco (GB)

# 3. Start the server
python3 piper-server.py
# → http://127.0.0.1:5000
```

Then set `PIPER_SERVER=http://localhost:5000` in your `.env`.

Available voices: `amy`, `kathleen`, `lessac`, `ryan` (US English), `alan`, `jenny_dioco` (British English). Full model list at [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices).

---

## Credits

Built by [celanthe](https://github.com/celanthe) · Art & design by [Zabethy](https://zabethy.com) · in progress

Built on [Erika Flowers](https://github.com/erikaflowers)' [Investiture](https://zerovector.design/investiture) framework · inspired by [Everbloom Reader](https://everbloomreader.com) by [celanthe](https://github.com/celanthe) and [Zabethy](https://zabethy.com)
