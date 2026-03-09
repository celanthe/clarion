# Clarion

**Give your AI agent a voice.**

Self-hosted TTS proxy and voice manager. Audition voices against your agent's actual dialogue, pick one, and pipe responses through it from the browser or CLI.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rinoliver)

---

## What it does

- **Audition voices.** Paste your agent's characteristic dialogue. Hear each voice read it. Pick the one that fits.
- **Save agent profiles.** One agent uses Kokoro `bm_george` at 1.0x, another uses Edge `en-GB-SoniaNeural`. Both saved, both exportable as JSON.
- **Five TTS backends.** Edge TTS (zero config), Kokoro (self-hosted, natural), Piper (self-hosted, lightweight), ElevenLabs (paid), Google Chirp 3 HD (paid).
- **Terminal integration.** Pipe agent responses through their voice from the CLI. Works with Claude Code via stop hook.

---

## Quickstart

### UI only (Edge TTS, no setup needed)

```sh
npm install
npm run dev
# http://localhost:5173
```

### With server (required for Kokoro, Piper, ElevenLabs, Google)

```sh
cd server && npm install && npm run dev
# http://localhost:8787
```

Or with Docker (Kokoro included):

```sh
docker-compose up
# Kokoro at :8880, Clarion server at :8080
```

---

## Voice audition

![Clarion voice audition with rainbow waveform](docs/img/clarion-waveform.png)

1. Open the **Audition** tab
2. Paste your agent's characteristic dialogue
3. Select a backend (Kokoro for the most natural voices)
4. Click play next to a voice to hear it read your text
5. Click **Use this voice**, name the agent, done

Short, characteristic sentences work best. Paste what your agent would actually say, not generic test text.

---

## CLI

```sh
# Speak as a saved agent
echo "The pattern holds." | node cli/speak.js --agent my-agent

# Stream in real time, sentence by sentence
claude "Walk me through this." | node cli/stream.js --agent my-agent
```

[Full CLI guide](docs/cli.md): speak.js, stream.js, and the Claude Code stop hook.

---

## API

```
POST /speak
Body: { "text": "Hello.", "backend": "edge", "voice": "en-GB-RyanNeural", "speed": 1.0 }
Returns: audio/mpeg

GET /voices?backend=edge|kokoro|piper|elevenlabs|google
Returns: { voices: [{ id, label, lang, gender }] }

GET /health
Returns: { edge: "up", kokoro: "up|down|unconfigured", ... }
```

---

## Backends

| Backend | Config needed | Quality | Voices |
|---------|--------------|---------|--------|
| Edge TTS | None | Good | 27 Neural (US, UK, AU, IE, CA, ZA, NZ, IN) |
| Kokoro | `KOKORO_SERVER=http://...` | Excellent | 11 (US + UK English) |
| Piper | `PIPER_SERVER=http://...` | OK | 6 (US + UK English) |
| ElevenLabs | `ELEVENLABS_API_KEY=...` | Excellent | 11 (US, UK, AU) |
| Google Chirp 3 HD | `GOOGLE_TTS_API_KEY=...` | Excellent | 16 (US + UK) |

[Backend setup guide](docs/backends.md): local Kokoro and Piper install, Docker, API key setup.

---

## Agent profiles

Profiles are stored in `localStorage` and exportable as JSON.

```json
{
  "id": "julian",
  "name": "Julian",
  "backend": "kokoro",
  "voice": "bm_george",
  "speed": 1.0,
  "proseOnly": true
}
```

Export from the UI (Export all button) or share a single agent profile as a `.json` file. Import via the Import button.

### What gets spoken

By default (`proseOnly: true`), Clarion strips non-conversational markdown before sending text to the TTS backend — so your agent only speaks what it would actually say, not the structure around it.

| Content | Spoken? |
|---|---|
| Prose paragraphs | Yes |
| Heading text (`## Like this`) | Yes — markers stripped |
| Bold / italic text | Yes — markers stripped |
| Fenced code blocks (` ``` `) | No — removed |
| Inline code (`` `like this` ``) | No — removed |
| Indented code blocks | No — removed |
| Bullet lists (`- item`) | No — removed |
| Numbered lists (`1. item`) | No — removed |

Toggle **Prose only** off on any agent card if you want everything spoken verbatim — useful for agents that narrate code reviews or read structured output.

---

## Deploy

**Cloudflare Worker** (Edge TTS only, or with secrets for paid backends):

```sh
cd server && wrangler deploy
wrangler secret put KOKORO_SERVER
wrangler secret put ELEVENLABS_API_KEY
wrangler secret put GOOGLE_TTS_API_KEY
```

**Docker Compose** (for local Kokoro):

```sh
docker-compose up
```

---

## Security

Clarion is designed for personal, self-hosted use. For deployments beyond localhost:

- Set `API_KEY=your-secret` in the server environment. The browser UI signs requests with HMAC-SHA256. The CLI uses `Bearer <key>`. Use HTTPS for remote deployments.
- CORS is open (`*`) by default. Set `ALLOWED_ORIGIN=https://your-domain.com` to restrict it.
- `kokoro-server.py` and `piper-server.py` bind to `127.0.0.1` by default. Do not expose them on `0.0.0.0` unless you trust the network.

---

## Credits

Built by [celanthe](https://github.com/celanthe) · Design by [Zabethy](https://zabethy.com) · Inspired by [Investiture](https://zerovector.design/investiture) by [Erika Flowers](https://github.com/erikaflowers) and [Everbloom Reader](https://everbloomreader.com)
