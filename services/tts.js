/**
 * Client-side TTS service.
 * Calls the Clarion server's /speak endpoint and plays the returned audio.
 */

import { getServerUrl } from './storage/agent-storage.js';

let _audioContext = null;
let _currentSource = null;

/**
 * Synthesize and play text using the Clarion server.
 * @param {string} text
 * @param {{ backend?: string, voice?: string, speed?: number }} options
 * @returns {Promise<void>}
 */
export async function speak(text, options = {}) {
  stop();

  const serverUrl = getServerUrl();
  const { backend = 'edge', voice, speed = 1.0 } = options;

  const response = await fetch(`${serverUrl}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, backend, voice, speed })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `Server error ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await playBuffer(arrayBuffer);
}

/**
 * Synthesize and play using a saved agent profile.
 * @param {string} text
 * @param {import('../core/domain/agent.js').Agent} agent
 */
export async function speakAsAgent(text, agent) {
  return speak(text, {
    backend: agent.backend,
    voice: agent.voice,
    speed: agent.speed
  });
}

/**
 * Stop any currently playing audio.
 */
export function stop() {
  if (_currentSource) {
    try { _currentSource.stop(); } catch {}
    _currentSource = null;
  }
}

/**
 * Fetch voices from the server for a given backend.
 * @param {'edge'|'kokoro'|'piper'} backend
 * @returns {Promise<Array>}
 */
export async function fetchVoices(backend) {
  const serverUrl = getServerUrl();
  const res = await fetch(`${serverUrl}/voices?backend=${backend}`);
  if (!res.ok) throw new Error(`Failed to fetch voices: ${res.status}`);
  const data = await res.json();
  return data.voices || [];
}

/**
 * Fetch backend health from the server.
 * @returns {Promise<{ edge: string, kokoro: string, piper: string }>}
 */
export async function fetchHealth() {
  const serverUrl = getServerUrl();
  const res = await fetch(`${serverUrl}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

// --- Internal ---

async function getAudioContext() {
  if (!_audioContext || _audioContext.state === 'closed') {
    _audioContext = new AudioContext();
  }
  if (_audioContext.state === 'suspended') {
    await _audioContext.resume();
  }
  return _audioContext;
}

async function playBuffer(arrayBuffer) {
  const ctx = await getAudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  _currentSource = source;

  return new Promise((resolve, reject) => {
    source.onended = resolve;
    source.onerror = reject;
    source.start(0);
  });
}
