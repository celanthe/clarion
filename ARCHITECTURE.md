# Clarion — Architecture

> Last Updated: 2026-03-19
>
> This file is the technical specification. Read VECTOR.md for philosophy and constraints. Follow what is written here — if reality diverges, update this file rather than working around it.

---

## Layers

Clarion has six distinct layers. Each has a clear job and clear boundaries.

| Layer | Location | Job | Rule |
|-------|----------|-----|------|
| Server | `server/` | Hono-based TTS proxy. Routes `/speak`, `/voices`, `/health`, `/diagnostics`. Runs as Cloudflare Worker or Node server. Auto-fallback to Edge TTS when a backend is unavailable. | No UI logic. No localStorage. Accepts HTTP, returns audio or JSON. |
| UI | `src/` | React 19 SPA. Tabs: Agents, Audition, Log. Manages agent lifecycle, voice audition, and crew log. | No direct `fetch` to TTS API — use `services/tts.js`. No storage writes — use `services/storage/`. |
| Services | `services/` | Client-side service modules: TTS client, HMAC crypto, agent storage. | No React imports. No DOM manipulation. Pure logic + fetch. |
| Domain | `core/` | Agent model: `createAgent`, `validateAgent`, `slugify`, `defaultVoice`. Voice list (`core/voices.js`). | No imports from `src/`, `services/`, or `server/`. Pure JS functions. |
| CLI | `cli/` | Node.js CLI scripts: `clarion-doctor`, `clarion-init`, `clarion-speak`, `clarion-status`, `clarion-stream`, `clarion-watch`, `clarion-router`, `clarion-migrate`. Stop hook: `hook.js`. Shared utilities in `cli/lib.js`. | No imports from `src/`, `services/`, `core/`, or `server/`. Uses `fetch` directly. Zero npm deps. CLI scripts import shared code from `cli/lib.js`. |
| Design System | `design-system/` | CSS custom properties. One file: `tokens.css` with 72 custom properties. | All color, spacing, typography, and radius values live here. Never hardcode these in component CSS. |

`content/en.json` — UI strings. Imported by components. Not a layer but a shared resource — copy lives here, not in components.

---

## Import Direction

```
server/          ←  standalone (no imports from src/ or services/)

src/ (UI)        ←  imports from services/, core/
  ↓
services/        ←  imports from core/ (domain model only); no imports from src/ or server/
  ↓
core/            ←  no imports from any project layer (pure JS)
  ↓
design-system/   ←  no imports

cli/             ←  standalone (no imports from any project layer)
                     uses Node built-ins + fetch only
                     CLI scripts import shared utilities from cli/lib.js
```

[OPERATOR: Verify — confirmed from App.jsx, services/tts.js, services/storage/agent-storage.js, core/domain/agent.js, cli/init.js. Key invariant: CLI and server are both isolated from the UI layer. cli/ must never import from src/ or services/ — it uses fetch to talk to the running server directly. services/ may import from core/ (domain model) but not from src/.]

---

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 | Component model for agent card management and voice audition UI |
| Build | Vite 6 | Fast HMR, minimal config, ESM-native |
| Styling | CSS custom properties | `design-system/tokens.css` — 72 custom properties, dark lavender theme. No Tailwind, no CSS Modules. |
| State | React local state (useState/useCallback) | No global state needed — agents loaded from localStorage, no cross-component sync required |
| Server | Hono + Cloudflare Worker | Thin proxy — routes requests to TTS backends. Worker runs at edge with zero cold-start. Also runs as Node server for local Docker setup via `node-server.js`. |
| Storage | localStorage + IndexedDB | localStorage: agent profiles, server URL. IndexedDB: HMAC signing key (via SubtleCrypto), crew message log. No backend persistence. |
| CLI | Node.js (built-ins only) | Scripts installed globally via `npm install -g .`. Zero npm dependencies by design. |
| Auth | HMAC-SHA256 (SubtleCrypto) | Browser signs requests using a key stored in IndexedDB. CLI uses `Bearer <key>`. Timing-safe comparison on server. Optional — unauthenticated if no `API_KEY` set. |
| Font | Space Grotesk (@fontsource) | Self-hosted via @fontsource — no Google Fonts CDN dependency |
| Deployment | Cloudflare Worker (wrangler) + Docker Compose | Worker for Edge TTS and paid APIs. Docker Compose for local Kokoro. |

---

## Project Structure

```
clarion/
├── CLAUDE.md                    # Agent onboarding — read first
├── VECTOR.md                    # Product doctrine
├── ARCHITECTURE.md              # This file — technical specification
├── README.md                    # Public-facing docs and quickstart
├── package.json                 # Root — Vite app + CLI bin entries (private: true)
├── vite.config.js               # Vite: outDir dist, port 5173
├── index.html                   # SPA entry point
│
├── design-system/
│   └── tokens.css               # 72 CSS custom properties — all design tokens
│
├── src/                         # UI layer — React 19
│   ├── main.jsx                 # React root mount
│   ├── App.jsx                  # Root: tab routing (Agents/Audition/Log/Setup), agent state, server config
│   ├── App.css                  # App-level styles
│   ├── global.css               # CSS resets and base styles (imports tokens.css)
│   └── components/
│       ├── AgentCard.jsx/css    # Edit one agent (backend, voice, speed, prose mode, mute)
│       ├── BackendStatus.jsx/css # Status dots, polls /health every 30s
│       ├── ClarionEmbed.jsx     # Standalone embeddable diagnostic panel (serverUrl prop, no App state)
│       ├── CrewLog.jsx/css      # Log tab — per-agent message history with replay
│       ├── SetupPanel.jsx/css   # Setup tab — backend cards, agent health, connection test
│       ├── VoiceAudition.jsx/css # Audition tab — paste dialogue, hear voices
│       ├── VoiceSelector.jsx/css # Grouped voice dropdown per backend
│       └── Waveform.jsx/css     # Real-time audio waveform visualizer
│
├── services/                    # Services layer — client-side
│   ├── tts.js                   # Fetch /speak, play audio, serial queue, speaking state, mute controls
│   ├── crypto.js                # HMAC key management (IndexedDB) and request signing
│   └── storage/
│       ├── agent-storage.js    # localStorage: agents, server URL, API key state
│       └── crew-log.js         # IndexedDB: per-agent spoken message history
│
├── core/                        # Domain layer — pure JS, no framework deps
│   ├── domain/
│   │   └── agent.js             # createAgent, validateAgent, slugify, defaultVoice
│   └── voices.js                # Backend voice lists
│
├── cli/                         # CLI layer — Node.js, zero npm deps
│   ├── lib.js                   # Shared utilities: config, agents, arg parsing, path constants
│   ├── doctor.js                # clarion-doctor: 10-check diagnostic with remediation hints
│   ├── init.js                  # clarion-init: multi-backend setup wizard, writes hook
│   ├── log.js                   # clarion-log: show crew-log.jsonl entries
│   ├── mute.js                  # clarion-mute: mute/unmute agents via agents.state.json
│   ├── speak.js                 # clarion-speak: pipe text to agent voice
│   ├── status.js                # clarion-status: server health, agent state, mute flags
│   ├── stream.js                # clarion-stream: real-time streaming, mute check, crew log
│   ├── watch.js                 # clarion-watch: persistent daemon, watches session JSONL, speaks live
│   ├── router.js                # clarion-router: multi-agent voice router, watches all sessions
│   ├── migrate.js               # clarion-migrate: one-time config migration from agent-preferences.json
│   └── hook.js                  # Claude Code stop hook — speaks last assistant message via clarion-stream
│
├── server/                      # Server layer — Cloudflare Worker (Hono)
│   ├── src/
│   │   ├── index.js             # Router: /health, /voices, /speak, /diagnostics + HMAC auth + Edge auto-fallback
│   │   ├── edge.js              # Edge TTS adapter (Microsoft Translator, no key)
│   │   ├── kokoro.js            # Kokoro adapter (OpenAI-compatible /v1/audio/speech)
│   │   ├── piper.js             # Piper adapter
│   │   ├── elevenlabs.js        # ElevenLabs adapter
│   │   ├── google.js            # Google Chirp 3 HD adapter
│   │   └── node-server.js       # Node.js server — auto-loads .dev.vars, readiness signal, graceful shutdown. Spawned by Terminus as managed child process.
│   ├── package.json             # Server deps: hono, @cloudflare/workers-types
│   └── wrangler.toml            # Cloudflare Worker config
│
├── content/
│   └── en.json                  # UI strings (copy lives here, not in components)
│
├── vector/                      # Investiture knowledge artifacts
│   ├── audits/                  # Skill chain audit reports
│   ├── decisions/               # Architecture Decision Records (ADRs)
│   ├── research/                # User research artifacts
│   └── schemas/                 # Zero-Vector schema definitions
│
├── docs/
│   ├── cli.md                   # CLI usage guide
│   └── backends.md              # Backend setup guide
│
├── test/
│   └── hmac-auth.js             # HMAC auth integration test (Node native, no framework)
│
├── docker-compose.yml           # Kokoro + Clarion server co-located
│
└── tasks/                       # Work-in-progress planning and briefing files
```

---

## Naming Conventions

| File type | Convention | Example |
|-----------|-----------|---------|
| React components | PascalCase `.jsx` | `AgentCard.jsx`, `VoiceSelector.jsx` |
| Component styles | Same name as component, `.css` | `AgentCard.css`, `VoiceSelector.css` |
| Service modules | camelCase `.js` | `tts.js`, `agent-storage.js` |
| Domain modules | camelCase `.js` | `agent.js`, `voices.js` |
| CLI scripts | kebab-case `.js` matched to bin entry | `init.js` → `clarion-init` |
| CSS custom properties | `--category-name` (kebab, scoped by category) | `--color-accent`, `--space-md`, `--font-size-lg` |

---

## State Management

React local state only — `useState` and `useCallback` in `App.jsx`. No global state library.

- **Agent list:** `useState(() => loadAgents())` — seeded from localStorage on mount, updated via `services/storage/agent-storage.js`
- **Tab state:** `useState('agents')`
- **Server/API config:** local state in App.jsx, persisted to localStorage on change
- **Health data:** fetched in `BackendStatus` component via `useEffect`, polled every 30s

Agents are the only persistent entity. Everything else is ephemeral UI state.

---

## Styling

CSS custom properties throughout. No Tailwind, no CSS Modules, no styled-components.

**Token file:** `design-system/tokens.css` — imported once in `src/global.css`. Defines 72 custom properties: spacing, typography, border radius, transitions, colors (dark lavender palette), status indicators, waveform.

**Component styles:** Each component has a co-located `.css` file. Components use tokens exclusively — no raw hex, rgb, or numeric pixel values in component CSS. All visual values come from `design-system/tokens.css`.

**Class naming:** No BEM, no utility prefix. Flat, descriptive class names scoped by component context (`.agent-card`, `.backend-status`, `.voice-audition`).

---

## API / Backend Pattern

The UI talks to the server through `services/tts.js`. The server is a stateless proxy — it does not store anything.

```
Browser (src/)  → services/tts.js      → fetch(serverUrl + '/speak')  → server/src/index.js → TTS backend
Browser (src/)  → services/storage/    → localStorage / IndexedDB (no server call)
CLI (cli/)      → fetch(serverUrl + '/speak')                          → server/src/index.js → TTS backend
```

**HMAC authentication:**
- Browser generates a signing key in IndexedDB (SubtleCrypto). Signs each request with `Clarion ts=<unix>,sig=<base64url>` in the `Authorization` header.
- CLI uses `Bearer <key>` from `CLARION_API_KEY` env var or `~/.config/clarion/config.json`.
- Server verifies with timing-safe comparison. 5-minute replay protection window.
- Auth is optional — if no `API_KEY` is set on the server, all requests are accepted.

**TTS backends (server-side):**
- `edge.js` — Microsoft Translator API, no key needed, always available
- `kokoro.js` — OpenAI-compatible `/v1/audio/speech`, self-hosted, returns `audio/mpeg` directly
- `piper.js` — self-hosted, lightweight
- `elevenlabs.js` — paid, API key via env
- `google.js` — Google Chirp 3 HD, paid, API key via env

---

## Testing

One test file: `test/hmac-auth.js` — verifies HMAC signing and verification logic. Runs with `npm test` (Node.js native, no framework).

[OPERATOR: If you want invest-architecture to audit test coverage, declare your testing strategy here — framework, file patterns, coverage expectations. Currently: one integration test for auth. If testing scope is intentionally narrow, that is a valid choice. Investiture audits what you declare, not what you omit.]

---

## Development Principles

*[OPERATOR: Verify — inferred from observed patterns across codebase.]*

1. **Zero-config default.** Edge TTS works with no server, no API key, and no environment setup. Every feature addition should ask: "does this break the zero-config case?" Observed in: zero-dependency CLI scripts, Edge TTS always available, browser-only mode with full functionality.

2. **No server state.** The server is a stateless proxy — it routes requests and returns audio. Nothing is stored server-side. Agent profiles live in the browser (localStorage) and on the user's machine (CLI config file). Observed in: no database, no KV cache, localStorage-first storage design.

3. **Layers don't cross.** CLI scripts do not import from UI or services layers. Server does not import from UI. Domain is pure JS with no framework dependencies. Layer violations break the ability to deploy and test components independently. Observed in: cli/ using fetch directly, core/ having zero external imports.

4. **Tokens before values.** All visual values (color, spacing, radius, typography) live in `design-system/tokens.css`. Components use tokens, never raw values. Observed in: global.css using `var()` exclusively, component CSS using `var()` for all design values.

5. **Agents are the unit.** Everything in Clarion — storage, CLI flags, UI cards, export format — is organized around the agent as the primary entity. A Clarion session is: pick an agent, hear it speak. Observed in: `createAgent`/`validateAgent` domain functions, `--agent` flag on all CLI scripts, agent profiles as the export/import format.

---

## How to Add a Feature

1. **Read doctrine.** Does VECTOR.md have a constraint that affects this feature? Does it violate a principle?
2. **Identify the layer.** Is this a UI concern (`src/`), a service (`services/`), a domain change (`core/`), a server addition (`server/`), or a CLI script (`cli/`)?
3. **Write in the right layer.** Do not reach across layer boundaries.
4. **Use tokens.** If the feature has a visual component, use `design-system/tokens.css` values only. Never add raw colors or spacing.
5. **Verify zero-config path.** The Edge TTS + browser-only path must still work after your change.
6. **CLI additions:** Zero npm deps. Node built-ins and `fetch` only.

---

## What Not to Do

- **No hardcoded colors or spacing.** All visual values in `design-system/tokens.css`. No raw hex, rgb, or pixel values in component CSS files.
- **No API keys in client-side code.** HMAC signing key is generated in the browser and stored in IndexedDB via SubtleCrypto — never hardcoded or logged. API keys for paid backends (ElevenLabs, Google) are server-only env vars.
- **No cross-layer imports.** CLI scripts use `fetch` directly — they do not import from `services/tts.js` or `services/storage/`. Server does not import from `src/`.
- **No data fetching in components.** Components call `services/tts.js` and `services/storage/agent-storage.js` — they do not call `fetch` directly.
- **No npm dependencies in CLI scripts.** `cli/*.js` uses Node built-ins and `fetch` only. Do not add a package dependency for what the stdlib provides.
- **No files over 200 lines without a reason.** When a file grows past 200 lines, split it or document why it should stay together.

---

## Decisions

Architecture decisions are recorded in `/vector/decisions/`. Each ADR is a markdown file with: decision, context, options considered, rationale.

Key decisions already documented in CLAUDE.md (not yet in formal ADRs):
- No KV cache — simplicity; add later if needed
- No rate limiting — personal tool, not shared infrastructure
- Kokoro uses `/v1/audio/speech` (OpenAI-compatible), not `/dev/captioned_speech`
- Agent profiles in localStorage — no backend needed, exportable as JSON
- Edge TTS via Microsoft Translator API — always available, no key needed
- Terminus integration: `node-server.js` emits a structured JSON readiness signal (`{"status":"ready","port":8080}`) on stdout so Electron can detect startup programmatically. Terminus spawns and manages the Node server as a child process following the same pattern as `wavesrv`.
