# Clarion CLI

Pipe your agent's responses through their voice from the terminal.

## Prerequisites

- Node.js 18 or later
- A running Clarion server (see [Backend Setup](backends.md))
- A player that can read audio from stdin or a file: `afplay` (macOS, built-in), `mpv`, `ffplay`, or `aplay` (Linux)

---

## Setup

### 1. Export agents from the UI

Open the Clarion UI, go to an agent card, and click **Export**. Or use **Export all** in the footer to get every agent at once. Save the resulting JSON to:

```
~/.config/clarion/agents.json
```

The CLI reads this file on every invocation. No restart needed after changes.

### 2. Set the server URL

The CLI defaults to `http://localhost:8787` (wrangler dev). If your server runs elsewhere, set the URL one of two ways:

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

### 3. Set an API key (if your server requires one)

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

## speak.js -- one-shot synthesis

`speak.js` synthesizes text and writes raw audio/mpeg to stdout. Pipe it to a player or redirect it to a file.

### Basic usage

```sh
# Speak as a saved agent (match by ID or name, case-insensitive)
echo "The pattern holds." | node cli/speak.js --agent my-agent

# Text as a positional argument
node cli/speak.js "Running diagnostics." --agent my-agent

# Direct voice selection without an agent profile
node cli/speak.js "Hello." --backend kokoro --voice bm_george

# Save output to a file instead of playing it
node cli/speak.js "Hello." --agent my-agent > hello.mp3
```

### Piping to a player

`speak.js` writes audio to stdout. Pipe it to a player:

```sh
# macOS (afplay reads from a file, not stdin -- use mpv or ffplay for streaming)
node cli/speak.js "Hello." --agent my-agent | afplay -

# mpv (Linux/macOS)
node cli/speak.js "Hello." --agent my-agent | mpv -

# ffplay (Linux/macOS/Windows)
node cli/speak.js "Hello." --agent my-agent | ffplay -nodisp -autoexit -
```

Note: `afplay` on macOS does not support stdin. If you want to use `afplay`, save to a file first:

```sh
node cli/speak.js "Hello." --agent my-agent > /tmp/out.mp3 && afplay /tmp/out.mp3
```

### All flags

| Flag | Description |
|------|-------------|
| `--agent <id>` | Use a saved agent profile by ID or name |
| `--backend <name>` | `edge`, `kokoro`, `piper`, `elevenlabs`, or `google` (default: `edge`) |
| `--voice <id>` | Voice ID for the selected backend |
| `--speed <n>` | Speed multiplier (default: `1.0`, range: `0.25`-`4.0`) |
| `--server <url>` | Clarion server URL (overrides `CLARION_SERVER`) |
| `--list-agents` | Print all saved agent profiles and exit |
| `--help` | Show usage and exit |

Flags from an `--agent` profile can be overridden individually. For example, `--agent my-agent --speed 1.5` uses the agent's voice but at 1.5x speed.

### List saved agents

```sh
node cli/speak.js --list-agents
```

Output:

```
  julian               kokoro   bm_george            Julian
  aria                 edge     en-GB-SoniaNeural    Aria
```

Columns: ID, backend, voice, display name.

---

## stream.js -- real-time streaming

`stream.js` reads stdin line by line and speaks each complete sentence as soon as it arrives. It pre-fetches the next sentence's audio while the current one plays, so gaps between sentences are minimal.

ANSI escape codes and Markdown formatting are stripped automatically before synthesis. Code fences are removed entirely (TTS should not read code).

### Basic usage

```sh
# Stream Claude Code output in your agent's voice
claude "Walk me through this architecture." | node cli/stream.js --agent my-agent

# Any streaming text source works
tail -f agent.log | node cli/stream.js --agent my-agent

# Pipe a file
cat notes.md | node cli/stream.js --agent my-agent
```

### Choosing a player

`stream.js` writes audio to a temp file and invokes a player directly (not stdout). The default player is `afplay` on macOS and `mpv` on Linux.

```sh
# Use mpv
... | node cli/stream.js --agent my-agent --player mpv

# Use ffplay
... | node cli/stream.js --agent my-agent --player ffplay

# Use aplay (Linux)
... | node cli/stream.js --agent my-agent --player aplay
```

### Skip Markdown stripping

If your input is already plain text, use `--plain` to skip the cleaner:

```sh
... | node cli/stream.js --agent my-agent --plain
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

## Claude Code stop hook -- speak every reply automatically

Set this up once and every Claude Code response will be spoken in your agent's voice without any manual piping.

### How it works

Claude Code fires a `Stop` event after every reply. The hook reads the session transcript from `~/.claude/projects/`, extracts the last assistant message, strips Markdown and ANSI codes, and streams it sentence by sentence to your Clarion server.

### 1. Find your Node path

```sh
which node
# or, if you use nvm:
echo $(nvm which current)
```

You will need this path for the shebang line and inside the script.

### 2. Create the hook script at `~/.claude/clarion-hook.js`

```js
#!/path/to/node
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

// Update these three values to match your setup:
const NODE_BIN    = '/path/to/node';
const CLARION_DIR = join(homedir(), 'path/to/clarion');  // where you cloned Clarion
const AGENT       = 'my-agent';                          // your agent ID or name

const STREAM = join(CLARION_DIR, 'cli', 'stream.js');

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

  const proc = spawn(NODE_BIN, [STREAM, '--agent', AGENT],
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

### 3. Register it in `~/.claude/settings.json`

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

### 4. Keep Clarion running

The hook is silent if the server is not up -- no errors, no audio. Add this to your `~/.zshrc` or `~/.bashrc` to auto-start the server on every new shell:

```sh
# Clarion -- auto-start TTS server
if ! curl -s --max-time 1 http://localhost:8080/health &>/dev/null; then
  KOKORO_SERVER=http://localhost:8880 \
    /path/to/node ~/path/to/clarion/server/src/node-server.js \
    &>/tmp/clarion-server.log &
  disown
fi
```

Update the paths and env vars to match your setup.

---

## Environment variable reference

| Variable | Where it's read | Description |
|----------|----------------|-------------|
| `CLARION_SERVER` | CLI (both scripts) | URL of your Clarion server. Default: `http://localhost:8787` |
| `CLARION_API_KEY` | CLI (both scripts) | Bearer token, if your server has `API_KEY` set |

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

Run `node cli/speak.js --list-agents` to see what IDs are available. IDs are case-sensitive. Check that `~/.config/clarion/agents.json` exists and contains your exported profiles.

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

**speak.js hangs with no output**

If you run `node cli/speak.js` without piping text and without a positional argument, it waits for stdin. Either pipe text to it or pass text as a positional argument.
