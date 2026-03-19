# Recording the Clarion Demo

The GIF teaser (`clarion-demo.tape`) is silent. The real demo needs **audio** — the whole point is you hear the voice. Record a screen capture with system audio.

## Setup before recording

```sh
# Terminal 1: Start the server
cd server && npm run dev

# Terminal 2: Verify everything works
clarion-status
clarion-speak --agent <your-agent> "Testing one two three."
```

Pick an agent with a distinctive voice (Kokoro `bm_george` or `af_heart` sound great).

## Recording tool

- **macOS:** QuickTime Player → File → New Screen Recording (enable internal audio via BlackHole or Loopback)
- **OBS:** Free, captures screen + system audio on all platforms
- **Loom:** Quick and gives you a shareable URL immediately

Output: MP4, 1080p, 30fps. Target length: **45–60 seconds**.

## Script

### Scene 1: The hook (10s)

Show a split terminal. Left: Claude Code running. Right: `clarion-watch` output.

```sh
# Right pane — start the watcher
clarion-watch --agent my-agent --verbose
```

```sh
# Left pane — ask Claude something
claude "What are the three most important things to know about this codebase?"
```

**The aha moment:** Claude's text appears on the left. Simultaneously, voice starts playing on the right. The agent is still working (tool calls running) but you're already hearing the answer.

Let this play for ~10 seconds. Don't interrupt.

### Scene 2: Voice audition (15s)

Switch to the browser UI at `localhost:5173`.

1. Click the **Audition** tab
2. Paste: `"I've reviewed the architecture and here's what stands out. The layer separation is clean, but the service layer is doing too much."`
3. Click play on 3-4 different voices
4. Click **Use this voice** on the one you like

### Scene 3: Multi-agent (10s)

Back to terminal. Show two agents speaking in sequence:

```sh
echo "The build passed. All 47 tests green." | clarion-speak --agent build-bot
echo "Deploying to staging now. ETA two minutes." | clarion-speak --agent deploy-bot
```

You hear two different voices, one after the other. No overlap.

### Scene 4: Outro (5s)

```sh
# Three lines to try it:
# npm install && npm run dev
# → localhost:5173
```

## After recording

1. Upload to YouTube (unlisted is fine) or host the MP4
2. Update README to embed/link the video
3. Use a screenshot frame from the recording as `docs/img/clarion-demo-thumb.png`

## What makes this demo work

- **Audio is the demo.** If someone watches on mute, they're missing the point. The YouTube title should say "with audio."
- **Show the live voice, not the setup.** Scene 1 is the hook because it shows something people haven't seen — voice concurrent with agent execution.
- **Keep it under 60 seconds.** Anything longer loses HN/LinkedIn attention.
