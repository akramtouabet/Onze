// Onze — IndexedDB pour les images importées (trop volumineuses pour chrome.storage).

const DB_NAME = 'onze';
const STORE = 'photos';
let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(mode, action) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = action(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const addPhoto = (blob, name) => {
  const record = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name, blob, added: Date.now() };
  return run('readwrite', (s) => s.put(record)).then(() => record);
};
export const getPhoto = (id) => run('readonly', (s) => s.get(id));
export const allPhotos = () => run('readonly', (s) => s.getAll());
export const photoKeys = () => run('readonly', (s) => s.getAllKeys());
export const removePhoto = (id) => run('readwrite', (s) => s.delete(id));
