// ─────────────────────────────────────────────────────────────────────────────
// PollingManager — Manages background REST polling for Data metrics (Funding, OI)
// ─────────────────────────────────────────────────────────────────────────────

export class PollingManager {
    constructor() {
        this.tasks = new Map();
    }

    /**
     * Register a polling task
     * @param {string} id Unique task identifier
     * @param {number} intervalMs How often to poll
     * @param {Function} fetchFn Promise returning function
     * @param {Function} onResult Callback when data returns
     */
    register(id, intervalMs, fetchFn, onResult) {
        if (this.tasks.has(id)) {
            this.unregister(id);
        }

        // Initial immediate fetch
        this._executeTask(id, fetchFn, onResult);

        // Scheduled polling
        const intervalId = setInterval(() => {
            this._executeTask(id, fetchFn, onResult);
        }, intervalMs);

        this.tasks.set(id, intervalId);
    }

    async _executeTask(id, fetchFn, onResult) {
        try {
            const data = await fetchFn();
            if (onResult) onResult(data);
        } catch (err) {
            console.warn(`Polling task [${id}] failed:`, err);
        }
    }

    unregister(id) {
        if (this.tasks.has(id)) {
            clearInterval(this.tasks.get(id));
            this.tasks.delete(id);
        }
    }

    clearAll() {
        for (const [id, timer] of this.tasks.entries()) {
            clearInterval(timer);
        }
        this.tasks.clear();
    }
}

// Export singleton instance
export const pollingManager = new PollingManager();
