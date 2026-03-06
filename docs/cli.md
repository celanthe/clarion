# Clarion CLI

Pipe your agent's responses through their voice from the terminal.

## Setup

1. Export agents from the Clarion UI — **Export** on any agent card, or **Export all** in the footer
2. Save the JSON to `~/.config/clarion/agents.json`
3. Set `CLARION_SERVER` env var, or add `{ "server": "http://..." }` to `~/.config/clarion/config.json`
4. Pipe output to a player: `| mpv -`, `| ffplay -nodisp -autoexit -`, `| afplay` (macOS)

## speak.js — one-shot synthesis

```sh
# Speak as a saved agent (by ID or name)
echo "The pattern holds." | node cli/speak.js --agent my-agent

# Direct voice selection
node cli/speak.js "Running diagnostics." --backend kokoro --voice bm_george

# List your saved agents
node cli/speak.js --list-agents

# Save as audio file
node cli/speak.js "Hello." --voice en-GB-RyanNeural > hello.mp3
```

## stream.js — real-time streaming

Speaks as the text arrives — sentence by sentence, in your agent's voice. Pre-fetches the next sentence while the current one plays so there's no gap. Strips ANSI codes and Markdown automatically.

```sh
# Pipe Claude Code output to your agent's voice in real time
claude "Walk me through this architecture." | node cli/stream.js --agent my-agent

# Any streaming source
tail -f agent.log | node cli/stream.js --agent my-agent

# Choose your player (afplay is the default on macOS)
... | node cli/stream.js --agent my-agent --player mpv
... | node cli/stream.js --agent my-agent --player ffplay

# Pass raw text without stripping markdown
... | node cli/stream.js --agent my-agent --plain
```

`stream.js` uses the same agent profiles and server config as `speak.js`. No extra setup needed.

---

## Claude Code hook — speak every reply automatically

Set this up once and every Claude Code response will be spoken in your agent's voice without any manual piping.

### 1. Create the hook script at `~/.claude/clarion-hook.js`

```js
#!/path/to/node   ← update to your Node 18+ path (e.g. ~/.nvm/versions/node/v22.11.0/bin/node)
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';

// ← Update these to match your setup
const NODE_BIN    = '/path/to/node';                    // same as shebang above
const CLARION_DIR = join(homedir(), 'path/to/clarion'); // where you cloned Clarion
const AGENT       = 'my-agent';                         // your agent ID

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

### 3. Keep Clarion running

The hook is silent if the server isn't up — no errors, just no audio. Add this to your `~/.zshrc` to auto-start on every new shell:

```sh
# Clarion — auto-start TTS server
if ! curl -s --max-time 1 http://localhost:8080/health &>/dev/null; then
  KOKORO_SERVER=http://localhost:8880 \
    /path/to/node ~/path/to/clarion/server/src/node-server.js \
    &>/tmp/clarion-server.log &
  disown
fi
```

**How it works:** Claude Code fires the `Stop` event after every reply. The hook reads the session transcript JSONL at `~/.claude/projects/`, extracts the last assistant message, strips Markdown and ANSI, and streams it sentence by sentence to your Clarion server — speaking each sentence as it's synthesized, with the next one pre-fetching in the background.
