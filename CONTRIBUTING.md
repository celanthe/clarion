# Contributing to Clarion

Clarion is a solo-maintainer project. Contributions are welcome — issues, bug fixes, new backends, CLI improvements. Here's what you need to know.

## Setup

```sh
git clone https://github.com/celanthe/clarion.git
cd clarion
npm install
npm run dev          # UI at http://localhost:5173 (Edge TTS works out of the box)
```

To run the server (needed for Kokoro, Piper, ElevenLabs, Google):

```sh
cd server && npm install && npm run dev   # http://localhost:8080
```

## Adding a TTS backend

Each backend is a single file in `server/src/` that exports:

- **`synthesize(text, voice, speed, ...)`** — returns a `Response` with `audio/mpeg`
- **`getVoices()`** — returns an array of `{ id, label, lang, gender }`
- **`checkHealth(serverUrl)`** (optional) — returns `"up"`, `"down"`, or `"unconfigured"`

Look at `server/src/edge.js` for the simplest example, or `server/src/kokoro.js` for one that talks to an external server.

Then wire it into the router in `server/src/index.js` — add a case to the `/speak` and `/voices` handlers, and add a health check entry.

## Adding a CLI command

CLI scripts live in `cli/`. Each is a standalone Node.js script with zero npm dependencies — Node built-ins and `fetch` only. No imports from `src/`, `services/`, or `core/`.

1. Create `cli/your-command.js` with a `#!/usr/bin/env node` shebang
2. Add a bin entry in `package.json`: `"clarion-your-command": "./cli/your-command.js"`
3. Run `npm install -g .` to register it locally

## Code style

- **ESM** (`"type": "module"` in package.json) — use `import`/`export`, not `require`
- **No TypeScript** — plain JS throughout
- **React 19** for the UI layer (`src/`)
- **CSS custom properties** from `design-system/tokens.css` — no raw hex, rgb, or pixel values in component CSS
- **Layer boundaries matter.** See ARCHITECTURE.md. The short version: CLI and server are standalone. UI imports from services and core. Services import from core. Core imports from nothing.

## Tests

```sh
npm test             # runs test/hmac-auth.js (Node native, no framework)
```

Test coverage is minimal. If you add a feature with testable logic, adding a test is appreciated but not required.

## Issues and PRs

- **Issues:** Bug reports, feature ideas, backend requests — all welcome. Include reproduction steps for bugs.
- **PRs:** Keep them focused. One feature or fix per PR. If it touches the architecture (new layer, new dependency), open an issue first to discuss.
- **No new npm dependencies in `cli/`** — this is a hard rule.
- **Verify the zero-config path still works** — Edge TTS in the browser with no server should always function after your change.
- All images must include descriptive alt text. For demo GIFs, provide a text description of what the GIF shows.

By submitting a pull request, you agree that your contribution is licensed under the MIT License.

## License

MIT. See [LICENSE](LICENSE).
