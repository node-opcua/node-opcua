/**
 * @module node-opcua-secure-channel
 * Nonce tracking for replay detection.
 *
 * Nonces are stored in a Map with a timestamp. Entries older than
 * `ttlMs` are lazily evicted on each lookup. If the map still
 * exceeds `maxSize` after eviction, the oldest entries are dropped.
 *
 * This ensures bounded memory usage while preserving replay
 * detection within the configured time window.
 */

export type Nonce = Buffer;

/**
 * returns true if the nonce is null or zero (all bytes set to 0)
 */
export function isEmptyNonce(nonce: Nonce): boolean {
    const countZero = nonce.reduce(
        (accumulator: number, currentValue: number) => accumulator + (currentValue === 0 ? 1 : 0),
        0
    );
    return countZero === nonce.length;
}

/** Default time-to-live for nonce entries: 4 hours */
const DEFAULT_TTL_MS = 4 * 3_600_000;
/** Default maximum number of nonce entries */
const DEFAULT_MAX_SIZE = 50_000;

let g_ttlMs = DEFAULT_TTL_MS;
let g_maxSize = DEFAULT_MAX_SIZE;

/**
 * Map from base64-encoded nonce hash to insertion timestamp (ms).
 */
const g_alreadyUsedNonce = new Map<string, number>();

/**
 * Evict all entries whose timestamp is older than `ttlMs`,
 * then drop the oldest entries if we still exceed `maxSize`.
 */
function _evict(): void {
    const cutoff = Date.now() - g_ttlMs;

    // 1. TTL-based eviction
    for (const [key, timestamp] of g_alreadyUsedNonce) {
        if (timestamp <= cutoff) {
            g_alreadyUsedNonce.delete(key);
        }
    }

    // 2. Size-based eviction (oldest first – Map preserves insertion order)
    if (g_alreadyUsedNonce.size > g_maxSize) {
        const excess = g_alreadyUsedNonce.size - g_maxSize;
        const iter = g_alreadyUsedNonce.keys();
        for (let i = 0; i < excess; i++) {
            const { value, done } = iter.next();
            if (done) break;
            g_alreadyUsedNonce.delete(value);
        }
    }
}

export function nonceAlreadyBeenUsed(nonce?: Nonce): boolean {
    if (!nonce || isEmptyNonce(nonce)) {
        return false;
    }

    _evict();

    const hash = nonce.toString("base64");
    if (g_alreadyUsedNonce.has(hash)) {
        return true;
    }
    g_alreadyUsedNonce.set(hash, Date.now());
    _evict();
    return false;
}

// ---------------------------------------------------------------------------
// Test helpers (internal)
// ---------------------------------------------------------------------------

/**
 * Exposed for testing only – returns the underlying nonce Map.
 * @internal
 */
export function _getNonceStore(): Map<string, number> {
    return g_alreadyUsedNonce;
}

/**
 * Override TTL and maxSize for testing. Pass `undefined` to reset to defaults.
 * @internal
 */
export function _setNonceCacheParameters(ttlMs?: number, maxSize?: number): void {
    g_ttlMs = ttlMs ?? DEFAULT_TTL_MS;
    g_maxSize = maxSize ?? DEFAULT_MAX_SIZE;
}
