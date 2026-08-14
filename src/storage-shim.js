// Standalone replacement for the Claude-artifact `window.storage` API.
// TextileSales.jsx was originally built to run inside a Claude artifact,
// where window.storage.get/set/delete/list persist data server-side. Outside
// that environment (this Netlify build, or the Docker image) there's no such
// backend, so this shim reproduces the same async get/set/delete/list
// contract against the browser instead.
//
// Backed by IndexedDB rather than localStorage. localStorage caps each origin
// at roughly 5 MB and its writes are synchronous (they block the main thread);
// a few thousand invoices with line items blows past that limit, at which
// point every save throws QuotaExceededError and nothing persists. IndexedDB
// typically allows hundreds of MB and writes asynchronously.
//
// Behaviour intentionally matches the original contract:
//   - get() on a missing key REJECTS (does not resolve null), because
//     TextileSales.jsx's readKey() relies on that to mean "no data yet"
//   - set/delete/list resolve with the same shapes as before
//
// "shared" data (the second argument) has no meaning for a single-user
// deployment, so personal and shared keys share one namespace.

const DB_NAME = "textile-bill";
const DB_VERSION = 1;
const STORE = "kv";
const LEGACY_PREFIX = "textile-bill-storage:";
const MIGRATION_FLAG = "textile-bill-idb-migrated";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB blocked by another open tab"));
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let result;
        try {
          result = fn(store);
        } catch (e) {
          reject(e);
          return;
        }
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error("transaction aborted"));
      })
  );
}

function reqValue(request) {
  // Wrap an IDBRequest so its result is readable once the tx completes.
  const box = { value: undefined };
  request.onsuccess = () => { box.value = request.result; };
  return box;
}

// ---- one-time migration from the old localStorage layout -------------------
// Runs before the first real read. Copies every legacy key into IndexedDB,
// VERIFIES each one landed, and only then marks migration complete. The
// legacy localStorage data is deliberately left in place: it costs nothing
// to keep, and it's the only safety net if IndexedDB is later cleared. It is
// only read again if migration never completed.
async function migrateFromLocalStorage() {
  let alreadyDone = false;
  try {
    alreadyDone = window.localStorage.getItem(MIGRATION_FLAG) === "1";
  } catch (e) {
    return; // localStorage unavailable (private mode) — nothing to migrate
  }
  if (alreadyDone) return;

  const legacy = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LEGACY_PREFIX)) {
        legacy.push([k.slice(LEGACY_PREFIX.length), window.localStorage.getItem(k)]);
      }
    }
  } catch (e) {
    return;
  }

  if (legacy.length === 0) {
    try { window.localStorage.setItem(MIGRATION_FLAG, "1"); } catch (e) { /* ignore */ }
    return;
  }

  // Don't overwrite anything already in IndexedDB — if a key exists there it
  // is newer than the legacy copy.
  await tx("readwrite", (store) => {
    for (const [key, value] of legacy) {
      const existing = store.get(key);
      existing.onsuccess = () => {
        if (existing.result === undefined) store.put(value, key);
      };
    }
  });

  // Verify every key is readable from IndexedDB before declaring success.
  const check = await tx("readonly", (store) => legacy.map(([key]) => reqValue(store.get(key))));
  const allPresent = check.every((box) => box.value !== undefined);
  if (allPresent) {
    try { window.localStorage.setItem(MIGRATION_FLAG, "1"); } catch (e) { /* ignore */ }
  }
}

let migrationPromise = null;
function ensureMigrated() {
  if (!migrationPromise) migrationPromise = migrateFromLocalStorage().catch(() => {});
  return migrationPromise;
}

// ---- the window.storage contract -------------------------------------------
async function get(key) {
  await ensureMigrated();
  const box = await tx("readonly", (store) => reqValue(store.get(key)));
  if (box.value === undefined) throw new Error(`storage key not found: ${key}`);
  return { key, value: box.value, shared: false };
}

async function set(key, value) {
  await ensureMigrated();
  await tx("readwrite", (store) => { store.put(value, key); });
  return { key, value, shared: false };
}

async function del(key) {
  await ensureMigrated();
  const box = await tx("readwrite", (store) => {
    const b = reqValue(store.get(key));
    store.delete(key);
    return b;
  });
  return { key, deleted: box.value !== undefined, shared: false };
}

async function list(prefix = "") {
  await ensureMigrated();
  const box = await tx("readonly", (store) => reqValue(store.getAllKeys()));
  const keys = (box.value || []).filter((k) => String(k).startsWith(prefix));
  return { keys, prefix, shared: false };
}

// ---- localStorage fallback --------------------------------------------------
// IndexedDB is unavailable in some private-browsing modes and can be blocked
// by strict privacy settings. Rather than leave the app with no persistence
// at all, fall back to the original localStorage implementation — smaller
// capacity, but better than losing everything on refresh.
const localFallback = {
  async get(key) {
    const raw = window.localStorage.getItem(LEGACY_PREFIX + key);
    if (raw === null) throw new Error(`storage key not found: ${key}`);
    return { key, value: raw, shared: false };
  },
  async set(key, value) {
    window.localStorage.setItem(LEGACY_PREFIX + key, value);
    return { key, value, shared: false };
  },
  async delete(key) {
    const existed = window.localStorage.getItem(LEGACY_PREFIX + key) !== null;
    window.localStorage.removeItem(LEGACY_PREFIX + key);
    return { key, deleted: existed, shared: false };
  },
  async list(prefix = "") {
    const keys = [];
    const full = LEGACY_PREFIX + prefix;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(full)) keys.push(k.slice(LEGACY_PREFIX.length));
    }
    return { keys, prefix, shared: false };
  },
};

function idbAvailable() {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch (e) {
    return false;
  }
}

if (typeof window !== "undefined" && !window.storage) {
  if (idbAvailable()) {
    window.storage = { get, set, delete: del, list };
    // Surface a hard IndexedDB failure early and switch to localStorage,
    // instead of letting every save fail silently later.
    openDb().catch(() => {
      window.storage = localFallback;
    });
  } else {
    window.storage = localFallback;
  }
}
