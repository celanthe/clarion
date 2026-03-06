# Security Policy

## Reporting a Vulnerability

If you find a security vulnerability in Clarion, please report it privately before public disclosure so it can be fixed first.

**Open a [GitHub Security Advisory](https://github.com/celanthe/clarion/security/advisories/new)** — this keeps the report private until a fix is released.

Please include:
- Description of the vulnerability and affected component
- Steps to reproduce
- Potential impact
- Suggested fix, if you have one

We'll acknowledge within 48 hours and aim to release a fix within 7 days for critical issues.

## Scope

Clarion is designed for **personal, self-hosted use**. The threat model assumes you control the server and trust the network it runs on. See [Security notes in the README](README.md#security-notes) for deployment hardening guidance.

In scope:
- Server code (`server/src/`)
- Authentication and signing (`services/crypto.js`)
- Python backend servers (`kokoro-server.py`, `piper-server.py`)
- CLI tools (`cli/`)

Out of scope:
- Attacks requiring physical access to the host machine
- Attacks against third-party services (ElevenLabs, Google TTS, Microsoft Edge TTS)
- Issues in dependencies not directly caused by Clarion's usage of them

## Supported Versions

Only the latest version receives security updates. There are no versioned releases — main is the supported version.
