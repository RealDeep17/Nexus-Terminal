// ─────────────────────────────────────────────────────────────────────────────
// AlertCooldown — Manages cooldown periods per alert ID
// ─────────────────────────────────────────────────────────────────────────────

export class AlertCooldown {
    constructor() {
        this.map = new Map();
    }

    set(id, ms) {
        if (ms <= 0) return;
        this.map.set(id, Date.now() + ms);
    }

    isOnCooldown(id) {
        const expiresAt = this.map.get(id);
        if (!expiresAt) return false;
        return expiresAt > Date.now();
    }

    cleanup() {
        const now = Date.now();
        for (const [id, expiresAt] of this.map.entries()) {
            if (expiresAt <= now) {
                this.map.delete(id);
            }
        }
    }

    clearAll() {
        this.map.clear();
    }
}
