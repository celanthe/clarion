# Core Assumptions — Clarion

**Author:** Kiran Oliver (operator) + Claude (drafted 2026-03-16)
**Status:** Unvalidated unless marked

Format: each assumption states what we're betting on, why we believe it, the risk if wrong, and how to validate it.

---

## Usage & Adoption

### A1 — People who clone it are trying to use it, not just browsing
**Bet:** The 300 GitHub clones represent users who want to run Clarion, not just people bookmarking it.
**Confidence:** LOW
**Risk if wrong:** The real adoption number is much smaller than 300. We're optimizing for a larger audience than exists.
**Validate:** Add a lightweight ping to `/health` telemetry opt-in, or ask in the README for users to star if they're actively using it.
**Status:** UNVALIDATED — 300 clones, no usage signal

### A2 — Users are not telling us it's broken because they can't get it running, not because it works fine
**Bet:** The silence is not satisfaction — it's either abandonment at setup or nobody finding a feedback channel.
**Confidence:** MEDIUM
**Risk if wrong:** It actually works well for most people and silence is a good sign.
**Validate:** Add a Discussions tab or issue template. Watch for error-related issues vs. feature requests.
**Status:** UNVALIDATED

---

## Use Case Validity

### A3 — Cognitive load reduction is a real, frequent pain for multi-agent users
**Bet:** Users managing 5+ agents simultaneously find reading all output exhausting and would genuinely use audio as a primary interface.
**Confidence:** MEDIUM — makes intuitive sense but untested
**Risk if wrong:** Audio is a nice-to-have, not a genuine workflow need. Most users just want one agent with a cool voice.
**Validate:** Interview anyone running agent fleets. Ask how they currently monitor output.
**Status:** UNVALIDATED

### A4 — The fleet management use case is real but secondary to single-agent personalization
**Bet:** Most users want one agent with a good voice, not ten agents with distinct voices. Fleet is a power-user edge case.
**Confidence:** MEDIUM
**Risk if wrong:** If fleet is the primary use case, the current UX (designed around single agent cards) is wrong.
**Validate:** Look at GitHub clone patterns — are they from individual devs or orgs? Watch issue requests.
**Status:** UNVALIDATED

### A5 — Users want to audition voices before committing, not just pick from a list
**Bet:** The Audition tab is a core differentiator. Users care about hearing their agent's actual dialogue before saving a profile.
**Confidence:** HIGH — this was the original motivation; built-in assumption from day one
**Risk if wrong:** Most users just pick a voice from a dropdown by name/description and never use Audition. We built the wrong feature as the centerpiece.
**Validate:** If we had analytics, track Audition tab usage vs. direct agent card creation.
**Status:** UNVALIDATED (but HIGH confidence)

---

## Technical Assumptions

### A6 — Edge TTS is stable enough to be a permanent zero-config default
**Bet:** The Microsoft Translator undocumented endpoint Edge TTS uses won't break or get restricted in a way that kills the zero-config path.
**Confidence:** MEDIUM — it's been reliable but it's undocumented
**Risk if wrong:** Edge TTS breaks and Clarion's core promise ("works with zero setup") collapses. Every user needs a server to get audio.
**Validate:** Monitor the endpoint. Have a fallback plan (browser-native SpeechSynthesis API is worse but always available).
**Status:** ACCEPTED RISK — documented in backends.md

### A7 — Self-hosters are comfortable with Docker Compose for Kokoro
**Bet:** Users who want the best voice quality (Kokoro) are comfortable running `docker-compose up` and waiting for model load.
**Confidence:** MEDIUM
**Risk if wrong:** Docker is a barrier. The 10-60s first-request latency on CPU is a dealbreaker. Users give up before hearing a good voice.
**Validate:** Watch for Docker-related issues. Ask in setup docs if Docker was a barrier.
**Status:** UNVALIDATED

### A8 — Storing agent profiles in localStorage is sufficient for the target user
**Bet:** Users with 1-10 agents don't need cross-device sync, cloud backup, or a database. localStorage + export/import is enough.
**Confidence:** HIGH — deliberate architectural decision, matches personal/self-hosted framing
**Risk if wrong:** Users with multiple machines or browsers get frustrated rebuilding their profiles. Export/import is too manual.
**Validate:** Watch for "sync" or "backup" feature requests.
**Status:** ACCEPTED DECISION — but worth monitoring

---

## Distribution & Discovery

### A9 — GitHub is the right distribution channel for this audience
**Bet:** The target user (developer, self-hoster, CLI power user) finds tools on GitHub, not through app stores, Product Hunt, or social media.
**Confidence:** HIGH
**Risk if wrong:** Missing a large audience of non-developer AI power users who don't browse GitHub.
**Validate:** Check referrer sources if we add any web presence.
**Status:** HIGH CONFIDENCE, LOW PRIORITY TO VALIDATE

### A10 — The Claude Code stop hook is the primary adoption driver
**Bet:** The use case that converts someone from "cloned it" to "using it daily" is the Claude Code stop hook — every reply gets spoken automatically.
**Confidence:** MEDIUM
**Risk if wrong:** Most users just run clarion-speak manually. The hook is too complex to set up and most people don't bother.
**Validate:** In clarion-init, track (opt-in) whether users choose to install the hook.
**Status:** UNVALIDATED

---

## Summary

| ID | Assumption | Confidence | Status |
|----|-----------|------------|--------|
| A1 | 300 clones = real users | LOW | Unvalidated |
| A2 | Silence = setup friction, not satisfaction | MEDIUM | Unvalidated |
| A3 | Cognitive load reduction is a real pain | MEDIUM | Unvalidated |
| A4 | Single-agent use > fleet use | MEDIUM | Unvalidated |
| A5 | Audition tab is a core differentiator | HIGH | Unvalidated |
| A6 | Edge TTS endpoint is stable | MEDIUM | Accepted risk |
| A7 | Docker Compose is not a barrier | MEDIUM | Unvalidated |
| A8 | localStorage is sufficient storage | HIGH | Accepted decision |
| A9 | GitHub is the right distribution channel | HIGH | Low priority |
| A10 | Stop hook is the primary adoption driver | MEDIUM | Unvalidated |

**Most urgent to validate:** A1 (how many real users?), A2 (why the silence?), A5 (is Audition actually used?), A10 (is the hook the thing that makes it stick?)
