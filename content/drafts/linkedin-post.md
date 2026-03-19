# LinkedIn Post — Clarion v0.4.0

Your AI agent finishes thinking, then reads you its answer.

That's the default everywhere. Voice comes after. Always after.

We built Clarion to fix that.

`clarion-watch` reads each assistant message the moment it's written — even before tool calls finish. Your agent speaks as it works, not after. You stop staring at a terminal waiting and start listening while you do other things.

This changes the interaction model. The agent becomes a collaborator you hear, not a log you read.

Here's what's in Clarion v0.4.0:

**Voice audition** — paste your agent's actual dialogue, hear every available voice read it back, pick the one that fits the personality. Short, characteristic sentences. Not generic test text.

**Five TTS backends** — Edge TTS works instantly, zero config, no API keys. Kokoro and Piper run self-hosted for privacy. ElevenLabs and Google Chirp 3 HD for premium quality.

**Multi-agent crews** — each agent gets its own voice and profile. Run a whole crew and concurrent responses queue automatically — no overlapping audio.

**proseOnly mode** — strips code blocks, markdown structure, and formatting so agents speak conversationally, not robotically.

Three lines to try it:

```
npm install
npm run dev
# → localhost:5173
```

MIT licensed. Self-hosted. No telemetry.

Demo (with audio): [TODO: link]

GitHub: https://github.com/celanthe/clarion

If you're building with AI agents and voice matters to your workflow, I'd love to hear how you're thinking about it.

#opensource #tts #aiagents #voiceai #developertools #claudecode
