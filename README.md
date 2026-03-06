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
- **Five TTS backends**: Edge TTS (zero config), Kokoro (self-hosted, natural), Piper (self-hosted, lightweight), ElevenLabs and Google Chirp 3 HD (paid APIs)
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
cd server && npm install && npm run dev
# → http://localhost:8787
```

Or with Docker (Kokoro included):

```sh
docker-compose up
# Kokoro at :8880, Clarion server at :8080
```

---

## Voice audition

1. Open the **Audition** tab
2. Paste your agent's characteristic dialogue — a few lines they'd actually say
3. Select a backend (Kokoro for the most natural voices)
4. Click ▶ next to each voice to hear it read your text
5. Click **Use this voice** → name the agent → saved

Short, characteristic sentences work best.

---

## CLI

```sh
# Speak as a saved agent
echo "The pattern holds." | node cli/speak.js --agent my-agent

# Real-time streaming — speaks sentence by sentence as text arrives
claude "Walk me through this." | node cli/stream.js --agent my-agent
```

**[Full CLI guide →](docs/cli.md)** — speak.js, stream.js, and the Claude Code hook (speak every reply automatically).

---

## API

```
POST /speak
{ "text": "Hello.", "backend": "edge", "voice": "en-GB-RyanNeural", "speed": 1.0 }
→ audio/mpeg

GET /voices?backend=edge|kokoro|piper|elevenlabs|google
→ { voices: [{ id, label, lang, gender }] }

GET /health
→ { edge: "up", kokoro: "up|down|unconfigured", ... }
```

---

## Backends

| Backend | Config needed | Quality | Voices |
|---------|--------------|---------|--------|
| **Edge TTS** | None | Good | 27 Neural voices (US, UK, AU, IE, CA, ZA, NZ, IN) |
| **Kokoro** | `KOKORO_SERVER=http://...` | Excellent | 11 voices (US + UK English) |
| **Piper** | `PIPER_SERVER=http://...` | OK | 6 voices (US + UK English) |
| **ElevenLabs** | `ELEVENLABS_API_KEY=...` | Excellent | 11 voices (US, UK, AU) — paid |
| **Google** | `GOOGLE_TTS_API_KEY=...` | Excellent | 16 Chirp 3 HD voices (US + UK) — paid |

**[Backend setup guide →](docs/backends.md)** — local Kokoro and Piper install, Docker, ElevenLabs and Google API key setup.

---

## Deploy

**Cloudflare Worker** (recommended for Edge TTS):
```sh
cd server && wrangler deploy
wrangler secret put KOKORO_SERVER
wrangler secret put ELEVENLABS_API_KEY
```

**Docker Compose** (for Kokoro self-hosters):
```sh
docker-compose up
```

---

## Security notes

Clarion is designed for personal, self-hosted use. If you're deploying it beyond localhost:

- Set `API_KEY=your-secret` in your server environment. The browser UI never sends the raw key — requests are signed with HMAC-SHA256. The CLI uses `Bearer <key>` — fine for localhost/LAN, use HTTPS for remote.
- Use HTTPS for non-localhost deployments. The text you're synthesizing travels the wire unencrypted otherwise.
- CORS is open (`*`) by default. Set `ALLOWED_ORIGIN=https://your-domain.com` to restrict it.
- `kokoro-server.py` and `piper-server.py` bind to `127.0.0.1` by default. Don't expose them on `0.0.0.0` unless you trust your network.

For vulnerability reports, see [SECURITY.md](SECURITY.md).

---

## Credits

Built by [celanthe](https://github.com/celanthe) · Design by [Zabethy](https://zabethy.com) · Inspired by [Investiture](https://zerovector.design/investiture) by [Erika Flowers](https://github.com/erikaflowers) and [Everbloom Reader](https://everbloomreader.com)
