# Clarion

**Give your AI agent a voice.**

Self-hosted TTS proxy and voice manager. Pick a voice that matches your agent's character, save it as a profile, and pipe their responses through it — in the browser or from the terminal.

Built for [Erika Flowers](https://github.com/eflowers) and her [Investiture](https://github.com/eflowers) framework. Inspired by [Everbloom Reader](https://everbloomreader.com).

Human-drawn design by [Zabethy](https://zabethy.com) · forthcoming.

---

## What it does

- **Audition voices** — paste your agent's actual dialogue, hear each voice read it, find the one that fits their character
- **Save agent profiles** — Julian uses Kokoro `bm_george` at 1.0×, your other agent uses Edge `en-GB-RyanNeural` — saved, exported, shareable as JSON
- **Three TTS backends**: Edge TTS (zero config, free), Kokoro (self-hosted, natural), Piper (self-hosted, lightweight)
- **Terminal integration** — pipe your agent's responses through their voice from the CLI

---

## Quickstart

### UI only (Edge TTS works immediately, no setup)

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

## Voice audition

1. Open the **Audition** tab
2. Paste your agent's characteristic dialogue
3. Select a backend (Kokoro recommended for natural voices)
4. Click ▶ next to each voice to hear it read your text
5. Click **Use this voice** → name the agent → saved

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

| Backend | Config needed | Quality | Notes |
|---------|--------------|---------|-------|
| Edge TTS | None | Good | Microsoft Neural voices. Always available. |
| Kokoro | `KOKORO_SERVER=http://...` | Excellent | Self-hosted. CPU image in docker-compose. |
| Piper | `PIPER_SERVER=http://...` | OK | Self-hosted. Lightweight. Fewer voices. |

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

Built by [celanthe](https://github.com/celanthe) · [zerovector.design](https://zerovector.design)

For [Erika Flowers](https://github.com/eflowers) and the Investiture framework

Design by [Zabethy](https://zabethy.com) · forthcoming

Inspired by [Everbloom Reader](https://everbloomreader.com)
