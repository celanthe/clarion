# Clarion — Agent Voice Manager

Self-hosted TTS proxy and agent voice manager. Built on the Investiture framework pattern.
Gives AI agents distinct, auditioned voices — one profile per crewmember, saved and portable.

## What it does

- **Multi-backend TTS**: Edge TTS (zero-config), Kokoro (self-hosted), Piper (self-hosted), ElevenLabs (paid API), Google Chirp 3 HD (paid API)
- **Agent profiles**: Named agents with saved backend + voice + speed
- **Export/import**: Share an agent config as JSON

## Architecture

See **ARCHITECTURE.md** for the full layer map, stack, naming conventions, import rules, and project structure tree. That file is the technical authority.

Quick reference (abbreviated — ARCHITECTURE.md is authoritative):

```
clarion/
  server/                   # Server layer — Cloudflare Worker (Hono)
  src/                      # UI layer — React 19 SPA
  services/                 # Services layer — TTS client, storage, crypto
  core/                     # Domain layer — agent model, voice lists
  cli/                      # CLI layer — clarion-doctor/init/speak/status/stream
  design-system/tokens.css  # CSS custom properties (72 tokens)
  content/en.json           # UI strings
  tasks/                    # Work-in-progress planning files
  vector/                   # Investiture knowledge artifacts
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
# → http://localhost:8080
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
→ audio/mpeg (X-Clarion-Fallback header if backend was unavailable and Edge was used)

GET /voices?backend=edge|kokoro|piper|elevenlabs|google
→ { backend, voices: [{ id, label, lang, gender }] }

GET /health
→ { edge: "up", kokoro: "up|down|unconfigured", piper: "up|down|unconfigured", elevenlabs: "up|down|unconfigured", google: "up|down|unconfigured" }

GET /diagnostics
→ { server: { version }, backends: { [name]: { status, configured, detail } } }
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

[Everbloom Reader](https://everbloomreader.com) is an EPUB, PDF, TXT, and ebook reader with TTS built for shared/multi-user use — it has RunPod GPU inference, KV caching, rate limiting, and budget tracking. Clarion is the personal, self-hosted version of that same TTS infrastructure: same backend adapters, all the shared-infra complexity stripped out.

Files ported and simplified:
- `server/src/edge.js` ← everbloom/server/src/edge.js (removed rate limiting, shared infra assumptions)
- `server/src/kokoro.js` ← everbloom/server/src/kokoro.js (removed RunPod, KV cache, budget tracking)
- `server/src/piper.js` ← everbloom/server/src/piper.js (minimal changes)
- `design-system/tokens.css` ← new, Investiture dark aesthetic

## Voice defaults

- Edge: `en-US-JennyNeural`
- Kokoro: `af_heart`
- Piper: `amy`
- ElevenLabs: `CwhRBWXzGAHq8TQ4Fs17` (Roger)
- Google: `en-US-Chirp3-HD-Achernar`

## Example agent config (Kokoro, British male)

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "backend": "kokoro",
  "voice": "bm_george",
  "speed": 1.0
}
```

Import via the UI's "Import JSON" button or export an existing agent.

---

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness
