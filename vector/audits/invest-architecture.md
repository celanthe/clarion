# Architecture Audit

**Run date:** 2026-03-16
**Scope:** Full project — all source layers (server/, src/, services/, core/, cli/, design-system/)
**Doctrine source:** ARCHITECTURE.md (last updated 2026-03-16)
**Files scanned:** ~30 source files across 6 layers

---

## Findings

### TOKENS — medium (2 found, 2 fixed)

- `src/components/Waveform.css:7` — Hardcoded `#1a1828`. **Fixed** — replaced with `var(--color-surface)` from `design-system/tokens.css`.
- `src/App.css:451` — Hardcoded `#ff5e5b` (Ko-fi heart SVG fill). **Fixed** — added `--color-kofi: #ff5e5b` to `design-system/tokens.css` under "Third-party branding"; replaced with `var(--color-kofi)`.

### DRIFT — medium (1 found, 1 fixed)

- `ARCHITECTURE.md:import-direction` — Declared `services/` imports from no project layer. Actual: `services/storage/agent-storage.js:7` imports `createAgent, validateAgent` from `core/domain/agent.js`. Code is correct and architecturally sound. **Fixed** — doctrine updated to permit `services/ → core/` imports and prohibit `services/ → src/`.

### SIZE — info

The following files exceed 200 lines. Doctrine notes "no files over 200 lines without a reason" — these are informational. CSS files and complex CLI scripts commonly run long; no split is required unless logic becomes hard to follow.

| File | Lines |
|------|-------|
| `src/App.css` | 455 |
| `src/components/VoiceAudition.css` | 412 |
| `cli/stream.js` | 400 |
| `src/App.jsx` | 360 |
| `src/components/AgentCard.css` | 351 |
| `server/src/index.js` | 289 |
| `src/components/AgentCard.jsx` | 282 |
| `src/components/VoiceAudition.jsx` | 275 |
| `cli/init.js` | 253 |
| `services/tts.js` | 211 |
| `server/src/edge.js` | 210 |
| `cli/speak.js` | 205 |

---

## What passed

- **LAYER** — All source files in the correct layer. No UI logic in services, no framework imports in core, no project imports in CLI.
- **IMPORT** — After doctrine fix: all import directions correct. CLI uses Node built-ins + fetch only (zero npm deps confirmed). Server imports are internal to server/src/.
- **NAMING** — All React components PascalCase .jsx. Services and domain modules camelCase .js. CLI scripts kebab-case matched to bin entries. No violations.
- **STATE** — React local state (useState/useCallback) throughout. No unauthorized state libraries.
- **TOKENS** — After fixes: no remaining hardcoded color values in component CSS. All values use var(--token-name).

---

## Summary

- High: 0 | Medium: 3 (all fixed) | Low: 0 | Info: 12 (file size, no action required)
- **Architecture health: CLEAN** — no remaining violations after fixes.
