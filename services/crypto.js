/**
 * Clarion request signing — HMAC-SHA256
 *
 * The raw API key is imported once and stored as a non-extractable CryptoKey
 * in IndexedDB. It can never be read back by JavaScript after that point.
 * Each request is signed with: HMAC-SHA256(key, "METHOD\n/path\ntimestamp")
 *
 * Captured signatures are bound to a specific method+path+5-minute window,
 * so replay attacks are not viable.
 *
 * The Bearer fallback (for CLI / non-browser clients) still works server-side
 * but is not used by the browser UI.
 */

const DB_NAME = 'clarion-security';
const STORE   = 'keys';
const KEY_ID  = 'api-signing-key';

// --- IndexedDB helpers ---

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbGet(db, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

function dbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

function dbDelete(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
}

// --- Public API ---

/**
 * Import a raw key string and store it as a non-extractable HMAC CryptoKey.
 * The raw value cannot be recovered after this call.
 * Pass an empty string or null to clear the key.
 */
export async function storeSigningKey(rawKey) {
  const db = await openDb();
  if (!rawKey) {
    await dbDelete(db, KEY_ID);
    return;
  }
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(rawKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,       // non-extractable — JS can't read the key bytes back
    ['sign']
  );
  await dbPut(db, KEY_ID, cryptoKey);
}

/** Returns true if a signing key is stored. */
export async function hasSigningKey() {
  try {
    const db  = await openDb();
    const key = await dbGet(db, KEY_ID);
    return !!key;
  } catch {
    return false;
  }
}

/**
 * Sign an outgoing request.
 * Returns an Authorization header value, or null if no key is configured.
 *
 * Signed payload: "METHOD\n/path\ntimestamp_seconds"
 * Header format:  "Clarion ts=<unix>,sig=<base64url>"
 */
export async function signRequest(method, path) {
  let key;
  try {
    const db = await openDb();
    key = await dbGet(db, KEY_ID);
  } catch {
    return null;
  }
  if (!key) return null;

  const ts     = Math.floor(Date.now() / 1000).toString();
  const toSign = `${method}\n${path}\n${ts}`;
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const sig    = toBase64url(new Uint8Array(sigBuf));

  return `Clarion ts=${ts},sig=${sig}`;
}

/**
 * Migrate an existing plaintext API key from localStorage to IndexedDB.
 * Removes the key from localStorage on success.
 * Safe to call on every app start — no-ops if nothing is in localStorage.
 */
export async function migrateApiKey() {
  const raw = localStorage.getItem('clarion_api_key');
  if (!raw) return;
  try {
    await storeSigningKey(raw);
    localStorage.removeItem('clarion_api_key');
  } catch {
    // Leave localStorage key in place if migration fails — better than losing it.
  }
}

function toBase64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
