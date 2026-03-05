/**
 * Agent profile storage — localStorage-backed.
 * Profiles are stored as a JSON array under the key 'clarion_agents'.
 * Export/import as JSON for sharing configs (e.g. share your Julian setup).
 */

import { createAgent, validateAgent } from '../../core/domain/agent.js';

const STORAGE_KEY = 'clarion_agents';
const SERVER_URL_KEY = 'clarion_server_url';
const API_KEY_KEY = 'clarion_api_key';

// --- Agents ---

/**
 * Load all agents from localStorage.
 * @returns {import('../../core/domain/agent.js').Agent[]}
 */
export function loadAgents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save an agent (insert or update by id).
 * @param {import('../../core/domain/agent.js').Agent} agent
 */
export function saveAgent(agent) {
  const agents = loadAgents();
  const idx = agents.findIndex(a => a.id === agent.id);
  if (idx >= 0) {
    agents[idx] = agent;
  } else {
    agents.push(agent);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

/**
 * Delete an agent by id.
 * @param {string} id
 */
export function deleteAgent(id) {
  const agents = loadAgents().filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

/**
 * Get a single agent by id.
 * @param {string} id
 * @returns {import('../../core/domain/agent.js').Agent | null}
 */
export function getAgent(id) {
  return loadAgents().find(a => a.id === id) ?? null;
}

// --- Export / Import ---

/**
 * Export all agents (or a single agent) as a JSON string.
 * Downloads the file in the browser.
 * @param {string} [id] - If provided, exports just that agent
 */
export function exportAgents(id) {
  const agents = id
    ? loadAgents().filter(a => a.id === id)
    : loadAgents();

  const json = JSON.stringify(agents, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = id ? `clarion-agent-${id}.json` : 'clarion-agents.json';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import agents from a JSON file (File object).
 * Merges with existing agents (imported agents overwrite by id).
 * @param {File} file
 * @returns {Promise<{ imported: number, errors: string[] }>}
 */
export async function importAgents(file) {
  const text = await file.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    return { imported: 0, errors: ['Invalid JSON file'] };
  }

  const items = Array.isArray(data) ? data : [data];
  const errors = [];
  let imported = 0;

  for (const item of items) {
    const agent = createAgent(item);
    const { valid, errors: errs } = validateAgent(agent);
    if (valid) {
      saveAgent(agent);
      imported++;
    } else {
      errors.push(`Agent "${item.name || '?'}": ${errs.join(', ')}`);
    }
  }

  return { imported, errors };
}

// --- Server URL ---

/**
 * Get the configured Clarion server URL.
 * Falls back to VITE env var or localhost.
 * @returns {string}
 */
export function getServerUrl() {
  const stored = localStorage.getItem(SERVER_URL_KEY);
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SERVER_URL) || null;
  // If stored URL is the old stale default, evict it so the env var wins
  if (stored === 'http://localhost:8787' && envUrl && envUrl !== 'http://localhost:8787') {
    localStorage.removeItem(SERVER_URL_KEY);
    return envUrl;
  }
  return stored || envUrl || 'http://localhost:8787';
}

/** @returns {string} */
export function getApiKey() {
  return localStorage.getItem(API_KEY_KEY) || '';
}

/** @param {string} key */
export function setApiKey(key) {
  if (key) {
    localStorage.setItem(API_KEY_KEY, key);
  } else {
    localStorage.removeItem(API_KEY_KEY);
  }
}

/**
 * Persist the server URL.
 * Rejects non-http(s) URLs to prevent protocol-based attacks.
 * @param {string} url
 */
export function setServerUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
    localStorage.setItem(SERVER_URL_KEY, url.replace(/\/$/, ''));
  } catch {
    // Invalid URL — ignore
  }
}
