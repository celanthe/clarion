# Clarion — Agent Voice Manager

Self-hosted TTS proxy and agent voice manager. Built on the Investiture framework pattern.
Created for Erika Flowers (Investiture author) to give Julian a consistent podcast voice.

## What it does

- **Multi-backend TTS**: Edge TTS (zero-config), Kokoro (self-hosted), Piper (self-hosted)
- **Agent profiles**: Named agents (e.g. Julian) with saved backend + voice + speed
- **Export/import**: Share your Julian config as JSON

## Architecture

```
clarion/
  server/                   # Cloudflare Worker (Hono)
    src/
      index.js              # Router: GET /health, GET /voices, POST /speak
      edge.js               # Edge TTS — Microsoft Translator API (no key needed)
      kokoro.js             # Kokoro proxy — /v1/audio/speech (OpenAI-compatible)
      piper.js              # Piper proxy — /v1/audio/speech
    wrangler.toml
    package.json

  design-system/tokens.css  # Dark, minimal (Investiture aesthetic)
  content/en.json           # UI strings
  core/domain/agent.js      # Agent model + validation
  services/
    storage/agent-storage.js # localStorage: agents + server URL
    tts.js                  # Client: fetch /speak, play audio
  src/
    components/
      AgentCard.jsx         # Edit one agent (name, backend, voice, speed, test)
      VoiceSelector.jsx     # Grouped voice dropdown per backend
      BackendStatus.jsx     # Status dots (polls /health every 30s)
    App.jsx
    App.css
    main.jsx
    global.css
  index.html
  vite.config.js
  package.json
  docker-compose.yml        # Kokoro + Clarion server
  .env.example
```

## Running it

### UI only (Edge TTS, zero config)
```sh
npm install
npm run dev
# → http://localhost:5173
```

### Server (Cloudflare Worker)
```sh
cd server
npm install
npm run dev
# → http://localhost:8787
```

### With Kokoro (docker-compose)
```sh
docker-compose up
# → Kokoro at :8880, Clarion server at :8080
```

## API

```
POST /speak
{ "text": "Hello.", "voice": "en-GB-RyanNeural", "backend": "edge", "speed": 1.0 }
→ audio/mpeg

GET /voices?backend=edge|kokoro|piper
→ { backend, voices: [{ id, label, lang, gender }] }

GET /health
→ { edge: "up", kokoro: "up|down|unconfigured", piper: "up|down|unconfigured" }
```

## Key decisions

- **No rate limiting** — it's your server, not shared infra
- **No KV cache** — keep it simple; add caching later if needed
- **No RunPod GPU logic** — Clarion uses CPU Kokoro (docker-compose)
- **Edge TTS always works** — Microsoft Translator API, no key needed
- **Kokoro uses `/v1/audio/speech`** — OpenAI-compatible, returns audio/mpeg directly
  (not `/dev/captioned_speech` which returns NDJSON — we don't need word timestamps)
- **Agent profiles in localStorage** — simple, no backend needed, exportable as JSON

## Ported from Everbloom

- `server/src/edge.js` ← everbloom/server/src/edge.js (removed rate limiting, shared infra)
- `server/src/kokoro.js` ← everbloom/server/src/kokoro.js (removed RunPod, KV, budget)
- `server/src/piper.js` ← everbloom/server/src/piper.js (minimal changes)
- `design-system/tokens.css` ← new, Investiture dark aesthetic

## Voice defaults

- Edge: `en-US-JennyNeural`
- Kokoro: `af_heart`
- Piper: `amy`

## Julian's recommended config

```json
{
  "id": "julian",
  "name": "Julian",
  "backend": "kokoro",
  "voice": "bm_george",
  "speed": 1.0
}
```

Import via the UI's "Import JSON" button or export an existing agent.
