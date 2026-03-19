# Multi-Agent Voice Setup

Run multiple agents with distinct voices. Concurrent responses queue automatically — no overlapping audio.

## Setup: Three agents, three voices

```sh
# Install CLI
cd /path/to/clarion && npm install -g .

# Create three agent profiles
clarion-init   # → "analyst" with Kokoro bm_george
clarion-init   # → "writer" with Edge en-GB-SoniaNeural
clarion-init   # → "reviewer" with Edge en-US-AriaNeural
```

Or create profiles directly in `~/.config/clarion/agents.json`:

```json
[
  { "id": "analyst", "name": "Analyst", "backend": "kokoro", "voice": "bm_george", "speed": 1.0, "proseOnly": true },
  { "id": "writer", "name": "Writer", "backend": "edge", "voice": "en-GB-SoniaNeural", "speed": 1.1, "proseOnly": true },
  { "id": "reviewer", "name": "Reviewer", "backend": "edge", "voice": "en-US-AriaNeural", "speed": 1.2, "proseOnly": true }
]
```

## Run concurrent watchers

Each watcher in its own terminal, each in a different project directory:

```sh
# Terminal 1
cd ~/projects/data-pipeline && clarion-watch --agent analyst

# Terminal 2
cd ~/projects/blog && clarion-watch --agent writer

# Terminal 3
cd ~/projects/api && clarion-watch --agent reviewer
```

Each watcher claims its Claude Code session. When multiple agents finish at the same time, `clarion-stream` serializes playback via a lock file — responses queue and play in order.

## Mute/unmute on the fly

```sh
clarion-mute analyst          # silence the analyst
clarion-mute analyst --off    # bring them back
clarion-mute --list           # see who's muted
```

## Check crew activity

```sh
clarion-log                          # recent entries, all agents
clarion-log --agent analyst          # filter by agent
clarion-log --count 50               # show more
```
