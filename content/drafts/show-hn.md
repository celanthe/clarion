# Show HN: Clarion — live voice for AI agents, speaks while the agent is still working

Most TTS integrations speak after your agent finishes. Clarion speaks *during* the session — `clarion-watch` reads each assistant message the moment it's written, before tool calls complete. Voice starts while the agent is still thinking.

Demo (with audio): [TODO: YouTube link]

It's a self-hosted TTS proxy and voice manager. You audition voices against your agent's actual dialogue, save profiles per agent, and pipe responses through the CLI or browser.

**Try it (Edge TTS, no API keys needed):**

```
git clone https://github.com/celanthe/clarion && cd clarion
npm install && npm run dev
# → localhost:5173
```

Five backends: Edge TTS (zero config), Kokoro (self-hosted, very natural), Piper (self-hosted, lightweight), ElevenLabs, Google Chirp 3 HD.

Key features:
- **Live session voice** — speaks mid-turn, not after
- **Voice audition** — paste your agent's real dialogue, hear every voice, pick the fit
- **Multi-agent crews** — per-agent voice profiles, automatic queue serialization (no overlap)
- **proseOnly mode** — strips code blocks and markdown so agents speak naturally
- **CLI streaming** — `claude "question" | clarion-stream --agent my-agent`

Runs on Node 18+. MIT licensed. No telemetry. Your server, your audio, your data.

GitHub: https://github.com/celanthe/clarion
