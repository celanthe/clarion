# Clarion

**Give your AI agent a voice.**

Self-hosted TTS proxy and voice manager. Pick a voice that fits your agent's character, save it as a profile, and pipe their responses through it — in the browser or from the terminal.

Built by [celanthe](https://github.com/celanthe). Art & design by [Zabethy](https://zabethy.com) · in progress.

Built on [Erika Flowers](https://github.com/erikaflowers)' [Investiture](https://github.com/erikaflowers) framework. Inspired by [Everbloom Reader](https://everbloomreader.com). Based on [zerovector.design](https://zerovector.design) principles.

---

## Why give your agent a voice?

If you're building AI agents with distinct characters — a cautious security analyst, a sharp product lead, a warm UX researcher — they probably already have different ways of speaking. Clarion makes that audible.

- **Characters stay consistent.** Julian always sounds like Julian. Different agents sound different from each other.
- **Demos and podcasts.** Record multi-agent conversations where each voice is distinct. Play back an agent's response in real time.
- **It changes how you work with them.** Hearing a response lands differently than reading it.

---

## What it does

- **Audition voices** — paste your agent's actual dialogue, hear each voice read it, find the one that fits
- **Save agent profiles** — Julian uses Kokoro `bm_george` at 1.0×, Arynna uses Edge `en-GB-SoniaNeural` — saved, exported, shareable as JSON
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

## CLI — pipe your agent's terminal output

```sh
# Speak text directly
node cli/speak.js "The pattern holds." --backend kokoro --voice bm_george

# Use a saved agent profile
node cli/speak.js --agent julian "Investiture protocol engaged."

# Pipe from stdin
echo "Hello." | node cli/speak.js --agent julian

# Pipe to a player
node cli/speak.js "Hello." --agent julian | mpv -

# List saved agents
node cli/speak.js --list-agents
```

**Agent profiles for the CLI** are stored at `~/.config/clarion/agents.json`.
Export them from the Clarion UI (Export button on any agent card).

**Server URL**: set `CLARION_SERVER=http://your-server:8787` or use `--server`.

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
| Edge TTS | None | Good | 18+ Neural voices (US, UK, AU, IE, CA, IN) |
| Kokoro | `KOKORO_SERVER=http://...` | Excellent | 11 voices (US + UK English) |
| Piper | `PIPER_SERVER=http://...` | Lightweight | 6 voices (US + UK English) |

Edge TTS is always available — no API key, no server, works out of the box. Kokoro produces the most natural-sounding voices and runs on CPU with no GPU required.

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

Built by [celanthe](https://github.com/celanthe)

Art & design by [Zabethy](https://zabethy.com) · in progress

Built on [Erika Flowers](https://github.com/erikaflowers)' [Investiture](https://github.com/erikaflowers) framework

Inspired by [Everbloom Reader](https://everbloomreader.com), built by celanthe and Zabethy

Based on [zerovector.design](https://zerovector.design) principles by Erika Flowers
