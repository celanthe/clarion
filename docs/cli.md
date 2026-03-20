# Clarion CLI

Pipe your agent's responses through their voice from the terminal.

## Prerequisites

- Node.js 18 or later
- A running Clarion server (see [Backend Setup](backends.md))
- A player that can read audio from stdin or a file: `afplay` (macOS, built-in), `mpv`, `ffplay`, or `aplay` (Linux)

---

## Setup

### 1. Install the CLI globally

From the Clarion directory:

```sh
npm install -g .
```

This adds `clarion-doctor`, `clarion-init`, `clarion-speak`, `clarion-stream`, `clarion-status`, `clarion-mute`, `clarion-log`, `clarion-watch`, `clarion-router`, and `clarion-migrate` to your PATH.

### 2. Run clarion-init

```sh
clarion-init
```

The wizard detects available backends, lets you pick one, fetches voices from the server, and optionally auditions them. It saves your agent profile and writes the Claude Code stop hook. That's it — skip steps 3–5 below if you used `clarion-init`.

If the server is unreachable, `clarion-init` falls back to Edge TTS voices embedded in the CLI.

### 3. Export agents from the UI (alternative)

Open the Clarion UI, go to an agent card, and click **Export**. Or use **Export all** in the footer to get every agent at once. Save the resulting JSON to:

```
~/.config/clarion/agents.json
```

The CLI reads this file on every invocation. No restart needed after changes.

### 3. Set the server URL

The CLI defaults to `http://localhost:8080`. If your server runs elsewhere, set the URL one of two ways:

**Environment variable (easiest):**

```sh
export CLARION_SERVER=http://localhost:8080
```

**Config file** (`~/.config/clarion/config.json`):

```json
{
  "server": "http://localhost:8080"
}
```

The config file and the `CLARION_SERVER` env var do the same thing. The env var takes precedence if both are set.

### 4. Set an API key (if your server requires one)

If you started the server with `API_KEY=your-secret`, the CLI must authenticate. Set:

```sh
export CLARION_API_KEY=your-secret
```

Or add it to `~/.config/clarion/config.json`:

```json
{
  "server": "http://localhost:8080",
  "apiKey": "your-secret"
}
```

If your server has no `API_KEY` set, skip this step.

---

## clarion-speak -- one-shot synthesis

`clarion-speak` synthesizes text and writes raw audio/mpeg to stdout. Pipe it to a player or redirect it to a file.

### Basic usage

```sh
# Speak as a saved agent (match by ID or name, case-insensitive)
echo "The pattern holds." | clarion-speak --agent my-agent

# Text as a positional argument
clarion-speak "Running diagnostics." --agent my-agent

# Direct voice selection without an agent profile
clarion-speak "Hello." --backend kokoro --voice bm_george

# Save output to a file instead of playing it
clarion-speak "Hello." --agent my-agent > hello.mp3
```

### Piping to a player

`clarion-speak` writes audio to stdout. Pipe it to a player:

```sh
# macOS (afplay reads from a file, not stdin -- use mpv or ffplay for streaming)
clarion-speak "Hello." --agent my-agent | afplay -

# mpv (Linux/macOS)
clarion-speak "Hello." --agent my-agent | mpv -

# ffplay (Linux/macOS/Windows)
clarion-speak "Hello." --agent my-agent | ffplay -nodisp -autoexit -
```

Note: `afplay` on macOS does not support stdin. If you want to use `afplay`, save to a file first:

```sh
clarion-speak "Hello." --agent my-agent > /tmp/out.mp3 && afplay /tmp/out.mp3
```

### All flags

| Flag | Description |
|------|-------------|
| `--agent <id>` | Use a saved agent profile by ID or name |
| `--backend <name>` | `edge`, `kokoro`, `piper`, `elevenlabs`, or `google` (default: `edge`) |
| `--voice <id>` | Voice ID for the selected backend |
| `--speed <n>` | Speed multiplier (default: `1.0`, range: `0.25`-`4.0`) |
| `--server <url>` | Clarion server URL (overrides `CLARION_SERVER`) |
| `--export` | Print saved agents as JSON to stdout and exit |
| `--list-agents` | Print all saved agent profiles and exit |
| `--help` | Show usage and exit |

Flags from an `--agent` profile can be overridden individually. For example, `--agent my-agent --speed 1.5` uses the agent's voice but at 1.5x speed.

### List saved agents

```sh
clarion-speak --list-agents
```

Output:

```
  julian               kokoro   bm_george            Julian
  aria                 edge     en-GB-SoniaNeural    Aria
```

Columns: ID, backend, voice, display name.

---

## clarion-stream -- real-time streaming

`clarion-stream` reads stdin line by line and speaks each complete sentence as soon as it arrives. It pre-fetches the next sentence's audio while the current one plays, so gaps between sentences are minimal.

ANSI escape codes and Markdown formatting are stripped automatically before synthesis. Code fences are removed entirely (TTS should not read code).

### Basic usage

```sh
# Stream Claude Code output in your agent's voice
claude "Walk me through this architecture." | clarion-stream --agent my-agent

# Any streaming text source works
tail -f agent.log | clarion-stream --agent my-agent

# Pipe a file
cat notes.md | clarion-stream --agent my-agent
```

### Choosing a player

`clarion-stream` writes audio to a temp file and invokes a player directly (not stdout). The default player is `afplay` on macOS and `mpv` on Linux.

```sh
# Use mpv
... | clarion-stream --agent my-agent --player mpv

# Use ffplay
... | clarion-stream --agent my-agent --player ffplay

# Use aplay (Linux)
... | clarion-stream --agent my-agent --player aplay
```

### Skip Markdown stripping

If your input is already plain text, use `--plain` to skip the cleaner:

```sh
... | clarion-stream --agent my-agent --plain
```

### All flags

| Flag | Description |
|------|-------------|
| `--agent <id>` | Use a saved agent profile by ID or name |
| `--backend <name>` | `edge`, `kokoro`, `piper`, `elevenlabs`, or `google` (default: `edge`) |
| `--voice <id>` | Voice ID for the selected backend |
| `--speed <n>` | Speed multiplier (default: `1.0`) |
| `--server <url>` | Clarion server URL (overrides `CLARION_SERVER`) |
| `--player <cmd>` | Audio player: `afplay`, `mpv`, `ffplay`, `aplay` |
| `--plain` | Skip ANSI and Markdown stripping |
| `--list-agents` | Print all saved agent profiles and exit |
| `--help` | Show usage and exit |

Status messages (agent name, errors) go to stderr. Audio goes directly to the player. Nothing is written to stdout.

---

## clarion-watch — live session daemon

`clarion-watch` is a persistent background process that watches a Claude Code session JSONL and speaks each assistant message as soon as it is written — including text blocks that appear before tool use. The voice starts while Claude is still working, not after it finishes.

This is the recommended alternative to the stop hook for users who want continuous, low-latency voice output without hook configuration.

### Basic usage

Start the watcher in a separate terminal before (or after) starting a Claude session:

```sh
# Auto-select agent if only one is configured
clarion-watch

# Explicit agent
clarion-watch --agent my-agent

# Watch a different project directory
clarion-watch --agent my-agent --cwd /path/to/project

# Verbose — logs each detected entry to stderr
clarion-watch --agent my-agent --verbose
```

Stop it with `Ctrl+C`.

### How it works

1. Resolves `~/.claude/projects/<slug>/` from `process.cwd()` (or `--cwd`)
2. Finds the most recent `*.jsonl` file in that directory
3. On startup, scans all existing entries and records their UUIDs — **does not speak history**
4. Polls the file every 200ms for new entries; for each new assistant entry, spawns `clarion-stream` with the text
5. Polls the project directory every 2s — automatically switches to a newer JSONL if a new Claude session starts
6. Respects mute state: if the agent is muted via `clarion-mute`, entries are skipped silently

### Coexistence with the stop hook

If both `clarion-watch` and the stop hook are active, the same message will be spoken twice — once mid-session (from watch) and once after Claude finishes (from the hook). The watcher logs a warning at startup if it detects this:

```
[clarion-watch] Warning: the Clarion stop hook is also registered in ~/.claude/settings.json.
[clarion-watch] Messages will be spoken twice — once mid-session (watch) and once at stop (hook).
[clarion-watch] Remove the Stop hook entry from settings.json if you want watch-only behavior.
```

Use one or the other. Watch gives earlier, more frequent voice output. The hook is simpler to set up and works globally across all projects without a running daemon.

### All flags

| Flag | Description |
|------|-------------|
| `--agent <id>` | Agent by ID or name. Required if more than one agent is configured. |
| `--cwd <path>` | Project directory to watch (default: `process.cwd()`) |
| `--verbose` | Log detection events (UUIDs, mute skips, session switches) to stderr |
| `--help` | Show usage and exit |

---

## clarion-router — multi-agent voice router

`clarion-router` is a single process that watches all active Claude Code project directories and routes each assistant message through the correct agent voice. Unlike running one `clarion-watch` per agent, `clarion-router` handles all sessions across all projects from a single process.

### Basic usage

```sh
# Watch all active projects, auto-detect agents
clarion-router

# Set a fallback/default agent voice
clarion-router --default julian

# Verbose — log agent detection and routing decisions
clarion-router --verbose

# Dry run — detect agents and log what would be spoken, but don't play audio
clarion-router --dry-run
```

You can also launch it via `clarion-watch --multi`, which delegates to `clarion-router`.

### Agent detection strategy (priority order)

1. **Agent tool call** — `description` or `prompt` field in an Agent tool use contains a known agent name
2. **"You are \<Name\>"** pattern in the first assistant message of a session
3. **Session→agent mapping** from `sessions.json` (written by `clarion-watch`)
4. **Fallback** to `--default` agent (or first agent in `agents.json`)

### Audio queuing

All speech is serialized through a single FIFO queue. Agents never overlap. Each queued item carries the agent ID so the correct voice is used.

### Error suppression

If a backend fails 3 times in a row, `clarion-router` suppresses further error output for that backend to avoid log spam. It logs once on the first failure and once when suppression kicks in.

### All flags

| Flag | Description |
|------|-------------|
| `--default <id>` | Fallback agent voice (default: first in `agents.json`) |
| `--verbose` | Log detection events, routing decisions, and queue activity to stderr |
| `--dry-run` | Detect agents and log what would be spoken, but don't play audio |
| `--help` | Show usage and exit |

---

## clarion-migrate — config migration from Terminus

`clarion-migrate` is a one-time migration tool that merges voice fields from Terminus agent preferences into Clarion's `agents.json`. Safe to run multiple times — it skips agents that already exist.

### Basic usage

```sh
# Preview what would change
clarion-migrate --dry-run

# Run the migration
clarion-migrate
```

### What it does

1. Reads `~/.config/terminus-dev/agent-preferences.json`
2. For each entry with voice fields (`voiceBackend`, `voiceName`, `voiceSpeed`), creates a Clarion agent profile
3. Writes the merged profiles to `~/.config/clarion/agents.json`
4. Strips the migrated voice fields from the Terminus prefs file (so they aren't duplicated)

### All flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Show what would change without writing |
| `--help` | Show usage and exit |

---

## clarion-mute — mute and unmute agents

`clarion-mute` mutes or unmutes an agent. When muted, `clarion-stream` and `clarion-watch` skip audio for that agent silently.

```sh
# Mute an agent
clarion-mute my-agent

# Unmute
clarion-mute my-agent --off

# List all muted agents
clarion-mute --list
```

Mute state is stored in `~/.config/clarion/agents.state.json`. It is read on each synthesis call — no restart needed.

---

## clarion-log — view the crew log

`clarion-log` prints recent entries from the crew log, which records every message spoken via `clarion-stream`.

```sh
# Show the 20 most recent entries (default)
clarion-log

# Show entries for one agent
clarion-log --agent my-agent

# Show more entries
clarion-log --count 50
```

The log is stored in `~/.config/clarion/crew-log.jsonl`.

---

## clarion-doctor — diagnose setup issues

`clarion-doctor` runs 10 checks on your Clarion installation and reports pass/fail with specific remediation hints. It is read-only — it never writes anything.

### Basic usage

```sh
clarion-doctor
```

### Example output

```
✓ Config directory (~/.config/clarion/)
✓ Config file valid
✓ Server reachable (http://localhost:8080)
  Backend: edge          ✓ up
  Backend: kokoro         ✓ up
  Backend: piper          — unconfigured
  Backend: elevenlabs     ✓ up
  Backend: google         — unconfigured
✓ 3 agents configured
✓ All agent backends are healthy
✓ Audio player: afplay
✓ No stale lock file
✓ Sessions file OK
✓ Docker: kokoro container running
```

Each failing check includes a remediation hint:

```
✗ Kokoro — down
    Is Docker running? Check with: docker ps
    Then: docker compose up -d

✗ Agent "my-agent" uses kokoro which is currently down
    Switch backend or start Kokoro. See above.
```

### Exit codes

`clarion-doctor` exits with code `0` if all checks pass, or `1` if any check fails. This makes it usable in scripts and CI.

---

## Claude Code stop hook -- speak every reply automatically

Set this up once and every Claude Code response will be spoken in your agent's voice without any manual piping.

### How it works

Claude Code fires a `Stop` event after every reply. The hook reads the session transcript from `~/.claude/projects/`, extracts the last assistant message, strips Markdown and ANSI codes, and streams it sentence by sentence to your Clarion server.

### 1. Create the hook script at `~/.claude/clarion-hook.js`

```js
#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

const AGENT = 'my-agent';  // your agent ID or name

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const { session_id, cwd, stop_hook_active } = JSON.parse(raw);
  if (stop_hook_active) process.exit(0);

  const transcript = join(homedir(), '.claude', 'projects',
    cwd.replace(/\//g, '-'), `${session_id}.jsonl`);
  if (!existsSync(transcript)) process.exit(0);

  const lines = readFileSync(transcript, 'utf8').trim().split('\n');
  let text = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    let e; try { e = JSON.parse(lines[i]); } catch { continue; }
    if (e.type !== 'assistant') continue;
    const t = (e.message?.content || [])
      .filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (t) { text = t; break; }
  }
  if (!text) process.exit(0);

  const proc = spawn('clarion-stream', ['--agent', AGENT],
    { stdio: ['pipe', 'ignore', 'inherit'] });
  proc.stdin.write(text);
  proc.stdin.end();
  await new Promise(r => proc.on('close', r));
}

main().catch(() => process.exit(0));
```

Make it executable and add a `package.json` so Node treats it as an ES module:

```sh
chmod +x ~/.claude/clarion-hook.js
echo '{"type":"module"}' > ~/.claude/package.json
```

### 2. Register it in `~/.claude/settings.json`

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/Users/you/.claude/clarion-hook.js"
          }
        ]
      }
    ]
  }
}
```

Replace `/Users/you` with your actual home directory path.

### 3. Keep Clarion running

The hook is silent if the server is not up -- no errors, no audio. Add this to your `~/.zshrc` or `~/.bashrc` to auto-start the server on every new shell:

```sh
# Clarion -- auto-start TTS server
if ! curl -s --max-time 1 http://localhost:8080/health &>/dev/null; then
  KOKORO_SERVER=http://localhost:8880 \
    node ~/path/to/clarion/server/src/node-server.js \
    &>/tmp/clarion-server.log &
  disown
fi
```

Update the path and env vars to match your setup.

---

## clarion-status — check what's running

Shows server health, loaded agents, hook state, and whether audio is currently playing.

```sh
clarion-status
```

Example output:

```
Server    http://localhost:8080  ✓ up
          edge           ✓ up
          kokoro         ✓ up
          piper          ✗ unconfigured
          elevenlabs     ✗ unconfigured
          google         ✗ unconfigured

Agents    2  (~/.config/clarion/agents.json)
          julian           kokoro      bm_george              Julian
          aria             edge        en-GB-SoniaNeural      Aria

Hook      ~/.claude/clarion-hook.js  ✓ active

Playing   idle
```

---

## Environment variable reference

| Variable | Where it's read | Description |
|----------|----------------|-------------|
| `CLARION_SERVER` | All CLI scripts | URL of your Clarion server. Default: `http://localhost:8080` |
| `CLARION_API_KEY` | All CLI scripts | Bearer token, if your server has `API_KEY` set |

Both variables can also be set in `~/.config/clarion/config.json`:

```json
{
  "server": "http://localhost:8080",
  "apiKey": "your-secret"
}
```

Environment variables take precedence over the config file.

---

## Troubleshooting

**"Agent not found"**

Run `clarion-speak --list-agents` to see what IDs are available. IDs are case-sensitive. Check that `~/.config/clarion/agents.json` exists and contains your exported profiles.

**No audio, no error**

Check that the server is running:

```sh
curl http://localhost:8080/health
```

If it returns `{}` or an error, the server is not up. Check the server logs.

**"Error: server error 401"**

Your server has `API_KEY` set. Set `CLARION_API_KEY` in your environment or config file to match.

**"Error: server error 503"**

The backend is configured but its upstream server is unreachable. For Kokoro, check that `kokoro-server.py` or the Docker container is running. For ElevenLabs/Google, check your API key.

**clarion-speak hangs with no output**

If you run `clarion-speak` without piping text and without a positional argument, it waits for stdin. Either pipe text to it or pass text as a positional argument.
