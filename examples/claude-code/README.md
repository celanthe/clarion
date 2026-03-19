# Clarion + Claude Code

Two ways to give Claude Code a voice: the live watcher (speaks during responses) or the stop hook (speaks after each response).

## Option 1: Live voice with clarion-watch (recommended)

```sh
# Install Clarion CLI
cd /path/to/clarion && npm install -g .

# Set up your agent (interactive — picks a voice)
clarion-init

# Start the watcher (speaks as Claude writes, before tools finish)
clarion-watch --agent my-agent
```

Leave `clarion-watch` running in a separate terminal. It tails the Claude Code session and speaks each assistant message the moment it's written.

## Option 2: Stop hook (speaks after each response)

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "command": "/path/to/clarion/cli/hook.js"
      }
    ]
  }
}
```

The hook reads the last assistant message from the session transcript and pipes it through `clarion-stream`.

## Both at once

You can run both. `clarion-watch` speaks live; the hook catches anything the watcher misses (e.g., if the watcher wasn't running when a response came in). They won't overlap — `clarion-stream` uses a lock file to serialize playback.

## Multi-agent routing

If you run `clarion-watch --agent agent-a` in one project and `clarion-watch --agent agent-b` in another, each session maps to its own agent voice. The hook reads the session-to-agent mapping from `~/.config/clarion/sessions.json`.
