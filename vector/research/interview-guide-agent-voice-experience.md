# Interview Guide: Agent Voice Experience and Modality Preferences

## Research Goals

1. Understand how hearing an AI agent's response (vs reading it) changes comprehension, trust, and working style.
2. Explore whether users form different relationships with agents that have distinct voices vs text-only agents.
3. For neurodivergent users: map when audio is the preferred modality and when it becomes overwhelming.
4. Test whether voice personality (warm vs neutral vs authoritative) changes how users evaluate agent output quality.
5. Explore the experience of switching between voiced agents in multi-agent workflows.
6. Surface feelings and boundaries around AI voices that sound "too human."

---

## Participant Criteria

- **Must have:** Uses AI agents (Claude Code, ChatGPT, Copilot, etc.) at least weekly. Comfortable with CLI or technical tools. Age 18+.
- **Nice to have:** Experience with TTS or voice interfaces. Runs multiple agents or agent personas. Neurodivergent (ADHD, autism, dyslexia — high relevance for modality switching). Has used Clarion or similar TTS-for-agents setup.
- **Exclude:** Participants whose AI use is exclusively casual/consumer (Siri, Alexa only). We need people who work with agents, not just talk to them.
- **Sample size target:** 8-10 participants. Aim for at least 4 who identify as neurodivergent.
- **Recruitment channels:** Claude Code community, AI dev communities, neurodivergent tech spaces, Clarion GitHub stargazers.

---

## Warm-Up (5 min)

**Goal:** Understand how the participant currently works with AI agents. Establish vocabulary — do they think of agents as tools, collaborators, or something else?

1. "Walk me through how you use AI agents in a typical work session. What are you doing, what's the agent doing?"
   - Note: number of agents, how they refer to them (it/they/name), how long sessions run.

2. "When an agent gives you a long response, how do you process it? Do you read every word, skim, or something else?"
   - Establishes baseline for how they consume agent output before introducing voice.

3. "Have you ever wished you could hear an agent instead of reading it? Or the opposite — have you ever wished a voice interface would just show you the text?"
   - Opens the modality question without leading.

---

## Core Questions (15 min)

### Q1: Audio vs Text Comprehension

**Question:** "Think about a time you read a long agent response and a time you heard one spoken aloud (or imagine it if you haven't). What feels different about those two experiences?"

**What we're trying to learn:** Whether audio changes comprehension depth, retention, or the sense of having "understood" the output. Whether reading feels like work and listening feels passive, or vice versa.

**Follow-up probes:**
- "Do you think you'd catch more errors in code if you heard it explained vs reading it?"
- "When you're tired or at the end of a long session, would you rather read or listen?"
- "Is there a type of agent output that works better as audio? Like explanations vs code vs planning?"
- "Does listening let you do other things at the same time, or does it demand the same attention as reading?"

---

### Q2: Voice and Trust

**Question:** "If two agents gave you the exact same answer, but one had a confident, warm voice and the other was text-only, do you think you'd trust them differently?"

**What we're trying to learn:** Whether voice creates a trust halo effect — does sounding good make the output feel more reliable? This has real implications for how voice design affects critical evaluation of agent work.

**Follow-up probes:**
- "Have you ever trusted an AI response more because of how it was presented, not what it said?"
- "Does a voice make an agent feel more like a person? Is that good or bad?"
- "If an agent made a mistake, would you notice it faster in text or audio?"
- "Does voice make you more or less likely to question the output?"

---

### Q3: Neurodivergent Modality Preferences

**Question:** "Do you have times where reading is hard but listening is fine, or times where audio is overwhelming but text is manageable? What determines which one works?"

**What we're trying to learn:** The conditions under which neurodivergent users switch preferred modality. Is it time of day, energy level, content type, sensory load, or something else? This directly informs when Clarion should be the default and when it should step back.

**Follow-up probes:**
- "On a low-energy day, which modality do you reach for?"
- "Does background noise change which one you prefer?"
- "Have you ever had audio become actively distressing — too much input? What was happening?"
- "If you could switch between voice and text mid-response, would that help?"
- "Do you ever use audio as a way to stay engaged when your visual attention has checked out?"

---

### Q4: Voice Personality and Output Evaluation

**Question:** "Imagine the same code review delivered in three voices: a warm, friendly one; a flat, neutral one; and a sharp, authoritative one. Would you read the review differently?"

**What we're trying to learn:** Whether voice personality biases how users evaluate the substance of agent output. If a warm voice makes criticism feel less urgent, or an authoritative voice makes suggestions feel like commands, that's a design problem.

**Follow-up probes:**
- "Which voice would you want for bad news — like 'this code has a security vulnerability'?"
- "Does a friendly voice make you take feedback less seriously?"
- "Would you want different voices for different kinds of tasks — one for creative work, another for debugging?"
- "Have you ever felt patronized by an AI's tone? What triggered that?"

---

### Q5: Multi-Agent Voice Switching

**Question:** "If you had three agents working on different parts of a project and each had a different voice, what would that experience be like? Helpful or chaotic?"

**What we're trying to learn:** Whether distinct voices help users track which agent said what (like recognizing speakers in a meeting), or whether multiple voices create cognitive overload. This validates Clarion's core multi-agent use case.

**Follow-up probes:**
- "Would distinct voices help you remember which agent gave you which piece of information?"
- "How many distinct voices could you keep track of before it gets confusing?"
- "Would you want to hear agents in sequence, or could you imagine listening to two at once?"
- "If all agents had the same voice, would that bother you?"
- "Do you already mentally assign 'personalities' to different agents or tools you use?"

---

### Q6: The Uncanny Valley — "Too Human"

**Question:** "Some AI voices are getting really close to sounding human. How do you feel about that? Is there a line where it gets uncomfortable?"

**What we're trying to learn:** Where the uncanny valley sits for agent voice specifically. Whether "too human" triggers discomfort, ethical concern, or if users actually prefer maximum naturalness. This informs voice selection defaults and guidance.

**Follow-up probes:**
- "Would you want to know that a voice is AI-generated, or would you rather just forget about it?"
- "Is there a difference between a natural voice reading code output vs reading a personal message?"
- "Have you ever mistaken an AI voice for a human? How did that feel when you realized?"
- "Do you think a very human voice makes people trust AI output too much?"
- "Is there a level of synthetic quality you actually prefer — like a reminder that this is a tool?"

---

## Wrap-Up (5 min)

1. "Is there anything about working with AI agents — voice or otherwise — that I should have asked about?"

2. "If you could design the perfect voice setup for your AI workflow, what would it look like?"
   - Forces synthesis. Listen for whether they want simplicity (one good voice) or control (per-agent customization).

3. "Would you be interested in trying Clarion for a week and sharing your experience?"
   - Recruit for follow-up.

4. Thank the participant. Confirm consent and next steps.

---

## What to Watch For

- **Anthropomorphization signals** — do they say "she told me" or "it output"? Do they assign gender to voices unprompted? This indicates how strongly voice creates perceived agency.
- **Modality switching mid-answer** — participants who describe wanting to hear the summary but read the code. This suggests hybrid voice+text is the real need, not pure audio.
- **Trust inflation** — participants who describe being less critical of spoken output. This is a design risk, not just a finding.
- **Sensory overload language** — "too much," "overwhelming," "I had to turn it off." Map the conditions precisely.
- **The "just right" description** — when they describe a voice they liked, note the specific qualities. "Warm but not sappy," "clear but not robotic." These are design specs.
- **Resistance to the premise** — some participants may feel voice is unnecessary for agents. That's valid data. Probe why.

---

## Assumption Validation Signals

| Assumption | Validated if... | Challenged if... |
|---|---|---|
| Audio reduces cognitive load for long agent output | Participants describe listening as less effortful than reading, especially during long sessions or low-energy states | Participants say audio requires equal or more effort, or that they zone out and miss content |
| Distinct voices help track multi-agent output | Participants can identify which agent said what by voice, or express that distinct voices would help | Participants find multiple voices confusing, or say they'd prefer visual differentiation (color, labels) |
| Neurodivergent users have variable modality preferences | Participants describe clear conditions where audio is better vs worse, and these vary by energy/context | Modality preference is fixed — always audio or always text, regardless of state |
| Voice personality biases output evaluation | Participants describe evaluating the same content differently based on voice tone | Participants say they evaluate substance regardless of delivery, or don't notice voice personality |
| Users have uncanny valley boundaries for agent voice | Participants describe a threshold where voice naturalness becomes uncomfortable or deceptive | Participants want maximum naturalness with no ceiling, or are indifferent to voice quality |
| Self-hosted voice matters (vs cloud TTS) | Participants express privacy concerns, latency frustrations, or vendor lock-in anxiety about cloud TTS | Participants are indifferent to where TTS runs and prefer convenience over control |

---

## Session Logistics

- **Duration:** 25 minutes (5 warm-up + 15 core + 5 wrap-up)
- **Format:** Remote video call (camera optional) or in-person
- **Recording:** Audio-record with consent; transcribe for analysis
- **Incentive:** TBD
- **Demo option:** If participant hasn't used Clarion, offer a brief live demo (2 min) between warm-up and core questions — let them hear the same text in 2-3 different voices to ground the conversation in experience rather than speculation.
- **Accessibility:** Offer questions in advance. Allow breaks. No time pressure.
