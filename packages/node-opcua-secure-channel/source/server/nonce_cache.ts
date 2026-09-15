/**
 * @module node-opcua-secure-channel
 * Nonce tracking for replay detection.
 *
 * Nonces are stored in a Map keyed by a fixed-width digest of the nonce,
 * with a timestamp. Entries older than `ttlMs` are lazily evicted on each
 * lookup. If the map still exceeds `maxSize` after eviction, the oldest
 * entries are dropped.
 *
 * Keying by a constant-size digest (rather than the raw nonce) keeps every
 * entry the same size regardless of the incoming nonce length, so the map's
 * memory is bounded by the entry count alone.
 */

import { createHash } from "node:crypto";

export type Nonce = Buffer;

/**
 * returns true if the nonce is null or zero (all bytes set to 0)
 */
export function isEmptyNonce(nonce: Nonce): boolean {
    const countZero = nonce.reduce((accumulator: number, currentValue: number) => accumulator + (currentValue === 0 ? 1 : 0), 0);
    return countZero === nonce.length;
}

/**
 * Maximum accepted length, in bytes, of a client nonce.
 *
 * A nonce is only ever key material: a client contributes at most a symmetric
 * key's worth of bytes (32 for the strongest supported policies) and the server
 * generates the remainder. 64 leaves generous headroom over the 32-byte standard
 * while still being small. Callers reject anything larger before it is cached.
 */
export const MAX_NONCE_LENGTH = 64;

/** Default time-to-live for nonce entries: 4 hours */
const DEFAULT_TTL_MS = 4 * 3_600_000;
/** Default maximum number of nonce entries */
const DEFAULT_MAX_SIZE = 10_000;

let g_ttlMs = DEFAULT_TTL_MS;
let g_maxSize = DEFAULT_MAX_SIZE;

/**
 * Map from nonce digest to insertion timestamp (ms).
 */
const g_alreadyUsedNonce = new Map<string, number>();

/**
 * Derive the fixed-width map key for a nonce.
 *
 * The digest is constant size (32 bytes, base64-encoded) whatever the nonce
 * length, which is what bounds the per-entry memory of the cache.
 */
function nonceKey(nonce: Nonce): string {
    return createHash("sha256").update(nonce).digest("base64");
}

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

    const hash = nonceKey(nonce);
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
 * Exposed for testing only – returns the map key used for a given nonce.
 * @internal
 */
export function _nonceKey(nonce: Nonce): string {
    return nonceKey(nonce);
}

/**
 * Override TTL and maxSize for testing. Pass `undefined` to reset to defaults.
 * @internal
 */
export function _setNonceCacheParameters(ttlMs?: number, maxSize?: number): void {
    g_ttlMs = ttlMs ?? DEFAULT_TTL_MS;
    g_maxSize = maxSize ?? DEFAULT_MAX_SIZE;
}
