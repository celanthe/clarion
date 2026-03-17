/**
 * Crew log — IndexedDB-backed message history for agent speech.
 *
 * Stores every utterance spoken by a named agent. Used by the Log tab
 * in the UI to show and replay what each crewmember has said.
 *
 * No npm dependencies — browser IndexedDB API only.
 */

const DB_NAME    = 'clarion-crew-log';
const DB_VERSION = 1;
const STORE      = 'messages';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('agentId',   'agentId',   { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Append a spoken message to the log.
 * @param {string} agentId
 * @param {string} text
 * @param {{ backend?: string, voice?: string }} meta
 */
export async function logCrewMessage(agentId, text, meta = {}) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req   = store.add({
      agentId,
      text,
      timestamp: new Date().toISOString(),
      backend:   meta.backend || null,
      voice:     meta.voice   || null,
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Retrieve log entries, newest first.
 * @param {{ agentId?: string, limit?: number, before?: string }} opts
 * @returns {Promise<Array>}
 */
export async function getCrewLog({ agentId, limit = 50, before } = {}) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(STORE, 'readonly');
    const store   = tx.objectStore(STORE);
    const results = [];

    const req = agentId
      ? store.index('agentId').openCursor(IDBKeyRange.only(agentId), 'prev')
      : store.openCursor(null, 'prev');

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor || results.length >= limit) {
        resolve(results);
        return;
      }
      const entry = cursor.value;
      if (!before || entry.timestamp < before) results.push(entry);
      cursor.continue();
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Clear log entries.
 * @param {string|null} agentId  null = clear all
 */
export async function clearCrewLog(agentId = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);

    if (agentId === null) {
      const req   = store.clear();
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
      return;
    }

    const req = store.index('agentId').openCursor(IDBKeyRange.only(agentId));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(); return; }
      cursor.delete();
      cursor.continue();
    };
    req.onerror = (e) => reject(e.target.error);
  });
}
