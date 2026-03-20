# Changelog

## 0.5.0 — 2026-03-19

### Breaking Changes

- **Default port changed** from `8787` to `8080`. Update `CLARION_SERVER` env var, `~/.config/clarion/config.json`, or scripts that reference the old port.
- **Watcher lock files moved** from a single global `~/.config/clarion/watcher.lock` to per-project files (`watcher-<slug>.lock`). The old lock file is no longer used.

### CLI

- **`clarion-router`** — new multi-agent voice router. A single process that watches all active Claude Code project directories for JSONL transcripts and routes each assistant message through the correct agent voice automatically. Handles subagent detection, audio queuing (agents never overlap), and persona-to-voice mapping. Supports `--default`, `--verbose`, and `--dry-run` flags.
- **`clarion-migrate`** — new one-time migration tool. Merges voice fields from `~/.config/terminus-dev/agent-preferences.json` into `~/.config/clarion/agents.json`. Safe to run multiple times — skips agents that already exist. Supports `--dry-run`.
- **`clarion-watch`**: new `--multi` flag delegates to `clarion-router` for multi-agent mode. Per-project lock files replace the single global `watcher.lock`, so multiple watchers across different projects no longer conflict. Incremental byte-offset reads replace full-file re-reads on each poll — significantly reduces I/O for long sessions. Atomic JSON writes (temp file + rename) for session registration to prevent corruption on concurrent writes.
- **Shared `fetchAudio`** — deduplicated from `speak.js` and `stream.js` into `lib.js`. Both scripts now import a single implementation with consistent timeout, error handling, and fallback header logging.
- **Shared `projectDir`** — path slug helper extracted to `lib.js`, used by both `hook.js` and `watch.js`.
- **`hook.js`**: now scans per-project lock files instead of a single global lock. Better error logging on bad input. Path encoding handles both forward and back slashes.

### Server

- **Port conflict detection** — `node-server.js` checks if the port is already in use before binding and exits with a clear error message instead of crashing.
- **Graceful shutdown** — handles `SIGTERM`, `SIGINT`, and `disconnect` signals with a clean shutdown and 3-second timeout.
- **Structured readiness signal** — prints `{"status":"ready","port":8080}` to stdout when listening, enabling parent processes (Electron, scripts) to detect startup programmatically.
- **Default port changed** — server and all CLI tools now default to port `8080` (was `8787`). `CLARION_SERVER` env var and config file override as before.
- **Auto-load `.dev.vars`** — the Node server now reads `.dev.vars` (or `.env` fallback) on startup so paid backend API keys work without passing env vars manually.

### Domain

- **`proseOnly` validation** — `agent.js` now validates that `proseOnly` is a boolean if present.

## 0.3.0 — 2026-03-16

### CLI

- **`clarion-watch`** — new persistent daemon that watches the Claude Code session JSONL and speaks each assistant message as soon as it is written. Voice fires mid-session, including text blocks that appear before tool use, not just at stop. On startup, existing entries are scanned without being spoken so restarting the watcher does not replay history. Automatically switches to a new JSONL when a new Claude session starts. Checks mute state before each synthesis call. Warns at startup if the stop hook is also active (double-speak risk).
- **`clarion-mute`** — new command to mute or unmute agents via `~/.config/clarion/agents.state.json`. `clarion-stream` and `clarion-watch` both respect this flag on each call — no restart needed.
- **`clarion-log`** — new command to view the crew log (`~/.config/clarion/crew-log.jsonl`). Supports `--agent` and `--limit` filters.
- **`clarion-stream`**: now writes every spoken sentence to the crew log with timestamp, agent ID, backend, and voice. Also checks mute state before each sentence (previously checked only at stream start). Adds `onPlayed` callback to `SpeakerQueue` to support the log write after audio plays.
- **`clarion-status`**: shows mute flag (`🔇 muted`) next to agent rows that are currently muted.

### UI

- **Log tab** — new Crew Log tab shows spoken message history per agent, pulled from IndexedDB. Replays any entry on demand.
- **Speaking state** — agent cards glow (accent border + subtle box-shadow) while that agent's voice is playing. Driven by `onSpeakingChange` subscription in `services/tts.js`.
- **Mute button** — each agent card now has an inline mute toggle (🔊 / 🔇). Mute is in-memory for the browser session; CLI mute is persisted to disk via `clarion-mute`.
- **`services/tts.js`**: adds `muteAgent`, `unmuteAgent`, `isMuted`, `getCurrentSpeakingAgentId`, `onSpeakingChange`. `speakAsAgent` now tracks speaking state, fires listeners, and writes to the crew log (IndexedDB) after each synthesis.

### Design system

- Add `--color-speaking-glow` token (`rgba(130, 114, 240, 0.25)`) for the agent card speaking state.

## 0.2.0 — 2026-03-10

### UI
- Switch primary typeface from Inter to Space Grotesk
- Replace rainbow waveform with monochromatic accent-color bars; remove glow effect
- Header now only shows backends that are actively configured — hides "Not configured" clutter on fresh installs
- Replace "Server settings" text button with gear icon; reduces header visual weight
- Audition save flow: user stays on the Audition tab after saving, with a success card, saved agent name, and "Go to Agents →" CTA — removes the silent auto-redirect
- Fix hover border direction on agent cards and voice rows (was darkening on hover, now lifts)
- Left-align empty state with max-width; remove centered layout
- Remove redundant "Voice Audition" heading (tab label already says it)
- Speed slider gets a subtle 1.0× reference notch
- Hide character counter until the user starts typing
- Backend status collapses to a single aggregate dot on mobile (<600px)
- Differentiate "down" (amber) from "unconfigured" (gray) in status indicators

### Accessibility
- Restore focus rings suppressed by component CSS across VoiceSelector, AgentCard name input, textarea, and save input
- Add `aria-controls` to server config toggle button
- Add `sr-only` utility class to global stylesheet
- Make "Use this voice" button visible when focused via keyboard
- Import error gets `role="alert"` and a dismiss button
- Expand prose-only checkbox touch target to 44×44px without changing visual size
- Add `noreferrer` to all external footer links

### Performance
- Replace `transition: all` with explicit property lists in 7 places
- Replace hardcoded `rgba` color with `color-mix()` token reference
- Switch waveform show/hide from `max-height` (layout) to `clip-path` (composited)

### CLI
- Concurrent `stream.js` instances now queue in completion order — multiple agents speaking from separate sessions no longer overlap
- Stale lock detection: if the lock holder process is dead or has held the lock for more than 60 seconds, the lock is broken automatically
- Instances that wait more than 60 seconds exit silently rather than playing out-of-context audio

### Bug fixes
- Fix server path in UI hint text (`node server/src/node-server.js`, not `node src/node-server.js`)
- Fix prose-only checkbox tap target overflowing into label text
- Fix tagline wrapping in header when backend status cluster is wide

## 0.1.0 — initial release
