---
project:
  name: clarion
  description: Self-hosted TTS proxy and agent voice manager — give your AI agent a consistent, auditioned voice.
  stage: development
  started: 2026-03-05
  repo: https://github.com/celanthe/clarion
owner:
  name: celanthe
knowledge:
  research: ./vector/research/
  schemas: ./vector/schemas/
  decisions: ./vector/decisions/
  audits: ./vector/audits/
---

# Clarion — Product Doctrine

## Problem Statement

[OPERATOR: Verify — inferred from README. AI agents are gaining voices, but there's no dedicated tool for auditioning and managing them. Users pick voices blind, configure TTS backends manually per-session, and rebuild setup from scratch across tools. Clarion gives an agent a persistent, auditioned voice — saved as a profile, piped through from the browser or CLI, consistent across every session.]

## Target Audience

[OPERATOR: Verify — inferred from README and project context. Developers and creators who run AI agents (Claude Code, custom agents) and want consistent, personalized voices for them. Self-hosters comfortable with Node.js. Users range from zero-config (Edge TTS, browser only) to power users running local Kokoro or Piper servers via Docker.]

## Core Value Proposition

[OPERATOR: Verify — inferred from README. Clarion is the missing step between "agent generates a response" and "agent speaks it out loud." It handles audition (hear a voice read your agent's actual dialogue), persistence (save the profile), and piping (CLI hook that fires on agent completion). No vendor lock-in — five backends, the free one works by default.]

## What This Is Not

[OPERATOR: Define what Clarion explicitly is not. Examples to consider: not a cloud service, not a shared multi-tenant platform, not a real-time voice chat system, not a transcription tool, not a general-purpose TTS SDK or library.]

## Design Principles

[OPERATOR: Your README emphasizes "self-hosted," "no config needed," and "give your agent a voice." Consider writing 3–5 principles around: zero-friction defaults (Edge TTS works out of the box), local control (your data, your hardware, your server), agent-first design (voices are profiles attached to named agents, not ad-hoc selections). The architecture reflects these — write the principles that explain why it was built this way.]

## Constraints

**Technical constraints (inferred from codebase — HIGH confidence):**
- No KV cache — keep it simple; caching can be added later if needed
- No rate limiting by default — designed for personal/self-hosted use, not shared infrastructure
- Edge TTS always available — Microsoft Translator API, no key needed, always a working default
- No database — agent profiles in localStorage (browser) and `~/.config/clarion/agents.json` (CLI); no backend persistence required
- `private: true` in package.json — self-hosted, not published to npm as a library
- CLI scripts have zero npm dependencies — Node built-ins and `fetch` only

**Deployment constraints:**
- Cloudflare Worker: Edge TTS works with no secrets; Kokoro/Piper/ElevenLabs/Google require env secrets via `wrangler secret put`
- Docker Compose: Kokoro and Piper servers bind to `127.0.0.1` by default — do not expose on `0.0.0.0` unless network is trusted
- CORS open (`*`) by default — set `ALLOWED_ORIGIN` to restrict for remote deployments
- HMAC auth optional — if no `API_KEY` is set on the server, requests are accepted unauthenticated (acceptable for localhost)

**License:** MIT. Investiture framework pattern copyright Erika Flowers / Zero-Vector Design — used with inspiration and gratitude.

## Quality Gates

[OPERATOR: Define your quality bar for shipping. What makes a change "done"? Examples: Edge TTS must always work without a server, CLI scripts must not gain npm dependencies, voice audition must be usable on mobile, HMAC signatures must not be logged, agent import/export round-trip must be lossless.]

---

## Core Relationship

> This project operates on a contractor model.

The agent working on this project is a skilled contractor — highly capable, opinionated about craft, and here to build what the operator defines. The operator (you) owns the vision, the constraints, and the calls that aren't purely technical. The agent owns the execution.

**What this means in practice:**
- The agent reads doctrine before writing code.
- When doctrine is silent, the agent asks rather than invents.
- When trade-offs arise, the agent surfaces them rather than deciding unilaterally.
- The agent's job is to make the operator's vision real, not to substitute the agent's own judgment for the operator's.

*These are Investiture defaults — the contractor relationship is a framework convention, not project-specific.*

---

## Seven Principles

*These are Investiture defaults. They apply to every project built on this framework.*

1. **Doctrine before code.** Read VECTOR.md, CLAUDE.md, and ARCHITECTURE.md before touching the codebase. The three files together define the project. Code that contradicts doctrine is wrong by definition.

2. **Infer from reality, not from defaults.** The actual project structure, naming patterns, and conventions are authoritative. If an Investiture default conflicts with what is actually in the project, reality wins. Document the divergence; don't silently override it.

3. **One file, one job.** Every file has a single clear responsibility. When a file starts doing two jobs, it's time to split it. The 200-line limit is a smell detector, not a rule — but when you hit it, ask why.

4. **Explicit over implicit.** Name things after what they do. Write types. Write contracts. Don't make other contributors (or the agent on the next session) guess what a function expects or returns.

5. **Surface trade-offs, don't hide them.** When a design choice has a cost — performance, complexity, flexibility — say so in a comment, a decision record, or the doctrine. Hidden trade-offs are technical debt that compounds silently.

6. **The chain validates.** The Investiture skill chain (backfill → doctrine → architecture) is a feedback loop, not a one-time setup. Run it when doctrine drifts. Run it when architecture drifts. The chain catches contradictions you stopped seeing.

7. **Operator judgment is final.** The agent flags violations and surfaces options. The operator decides. When the operator makes a call the agent disagrees with, the agent builds it anyway and records the decision in `/vector/decisions/`.

**Non-negotiables:**
- Never write to CLAUDE.md, VECTOR.md, or ARCHITECTURE.md without the operator's explicit instruction.
- Never generate or commit API keys, secrets, or credentials.
- Never override a decision the operator has already made — record it and move on.

---

## Research Status

| Area | Location | Status |
|------|----------|--------|
| User interviews | `./vector/research/interviews/` | Not started |
| JTBD analysis | `./vector/research/jtbd/` | Not started |
| Personas | `./vector/research/personas/` | Not started |
| Competitive analysis | `./vector/research/competitive/` | Not started |
| Assumptions | `./vector/research/assumptions/` | Not started |
| Schemas | `./vector/schemas/` | Not started |
| Decisions | `./vector/decisions/` | Not started |
