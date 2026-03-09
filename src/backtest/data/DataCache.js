// ─────────────────────────────────────────────────────────────────────────────
// DataCache — IndexedDB cache for large kline datasets
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'nexus_backtest_cache';
const DB_VERSION = 1;
const STORE_NAME = 'klines';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export default class DataCache {
    static generateKey(symbol, interval, startDate, endDate) {
        return `${symbol}_${interval}_${startDate}_${endDate}`;
    }

    static async get(cacheKey) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.get(cacheKey);
                request.onsuccess = () => {
                    const result = request.result;
                    if (!result) { resolve(null); return; }
                    if (Date.now() - result.timestamp > CACHE_EXPIRY_MS) {
                        DataCache.remove(cacheKey).catch(() => { });
                        resolve(null);
                        return;
                    }
                    resolve(result.data);
                };
                request.onerror = () => reject(request.error);
            });
        } catch (err) {
            console.warn('DataCache.get failed:', err);
            return null;
        }
    }

    static async set(cacheKey, data) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.put({ cacheKey, data, timestamp: Date.now() });
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            console.warn('DataCache.set failed:', err);
        }
    }

    static async remove(cacheKey) {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.delete(cacheKey);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            console.warn('DataCache.remove failed:', err);
        }
    }

    static async clear() {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                store.clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (err) {
            console.warn('DataCache.clear failed:', err);
        }
    }
}
