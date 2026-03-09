// ─────────────────────────────────────────────────────────────────────────────
// OrderTypes
// ─────────────────────────────────────────────────────────────────────────────

export const OrderTypes = {
    MARKET: 'MARKET',
    LIMIT: 'LIMIT',
    STOP: 'STOP',
    STOP_LIMIT: 'STOP_LIMIT',
};

export const OrderDirections = {
    LONG: 'long',
    SHORT: 'short',
};

export const OrderStatus = {
    PENDING: 'pending',
    READY: 'ready',
    FILLED: 'filled',
    CANCELLED: 'cancelled',
    REJECTED: 'rejected',
};
