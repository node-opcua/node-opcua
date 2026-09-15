import { randomBytes } from "node-opcua-utils";
import {
    _getNonceStore,
    _nonceKey,
    _setNonceCacheParameters,
    isEmptyNonce,
    MAX_NONCE_LENGTH,
    nonceAlreadyBeenUsed
} from "../source/server/nonce_cache.js";

describe("NonceCache – replay detection with TTL eviction", () => {
    beforeEach(() => {
        const store = _getNonceStore();
        store.clear();
        _setNonceCacheParameters(undefined, undefined); // reset to defaults
    });

    // -- basic behaviour -----------------------------------------------------

    it("should return false for a never-seen nonce", () => {
        const nonce = randomBytes(32);
        nonceAlreadyBeenUsed(nonce).should.equal(false);
    });

    it("should return true when the same nonce is submitted twice", () => {
        const nonce = randomBytes(32);
        nonceAlreadyBeenUsed(nonce).should.equal(false);
        nonceAlreadyBeenUsed(nonce).should.equal(true);
    });

    it("should return false for undefined nonce", () => {
        nonceAlreadyBeenUsed(undefined).should.equal(false);
    });

    it("should return false for an all-zero nonce", () => {
        const nonce = Buffer.alloc(32, 0);
        isEmptyNonce(nonce).should.equal(true);
        nonceAlreadyBeenUsed(nonce).should.equal(false);
    });

    it("should handle a short nonce (1 byte)", () => {
        const nonce = Buffer.from([0x42]);
        nonceAlreadyBeenUsed(nonce).should.equal(false);
        nonceAlreadyBeenUsed(nonce).should.equal(true);
    });

    // -- TTL eviction --------------------------------------------------------

    it("old entries should be evicted after their TTL expires", () => {
        const store = _getNonceStore();
        const N = 1000;

        store.size.should.equal(0, "store should start empty");

        for (let i = 0; i < N; i++) {
            nonceAlreadyBeenUsed(randomBytes(32));
        }

        store.size.should.equal(N, `after ${N} unique nonces the store should contain exactly ${N} entries`);

        // Simulate time passing by mutating timestamps to 5 hours ago
        const fiveHoursAgo = Date.now() - 5 * 3_600_000;
        for (const key of store.keys()) {
            store.set(key, fiveHoursAgo);
        }

        // Insert one more nonce – this should trigger eviction of old entries
        nonceAlreadyBeenUsed(randomBytes(32));

        // Old entries should have been evicted, only the fresh one remains
        store.size.should.equal(1, "expired nonce entries should be evicted");
    });

    it("nonce can be reused after TTL expiry (accepted trade-off)", () => {
        _setNonceCacheParameters(1000, undefined); // 1 second TTL for test
        const store = _getNonceStore();

        const nonce = randomBytes(32);
        nonceAlreadyBeenUsed(nonce).should.equal(false, "first use accepted");
        nonceAlreadyBeenUsed(nonce).should.equal(true, "replay within TTL rejected");

        // Simulate expiry by backdating the entry
        const hash = _nonceKey(nonce);
        store.set(hash, Date.now() - 2000); // 2 seconds ago, past the 1s TTL

        // After expiry, the nonce is no longer in the cache
        nonceAlreadyBeenUsed(nonce).should.equal(false, "nonce should be accepted again after TTL expiry");
    });

    // -- maxSize cap ---------------------------------------------------------

    it("cache size should never exceed maxSize", () => {
        const maxSize = 100;
        _setNonceCacheParameters(undefined, maxSize);

        const store = _getNonceStore();

        for (let i = 0; i < maxSize + 50; i++) {
            nonceAlreadyBeenUsed(randomBytes(32));
        }

        store.size.should.be.belowOrEqual(maxSize, `store size should never exceed maxSize (${maxSize})`);
    });

    it("maxSize eviction should remove oldest entries first", () => {
        const maxSize = 5;
        _setNonceCacheParameters(undefined, maxSize);

        const store = _getNonceStore();
        const nonces: Buffer[] = [];

        // Insert maxSize + 2 nonces
        for (let i = 0; i < maxSize + 2; i++) {
            const n = randomBytes(32);
            nonces.push(n);
            nonceAlreadyBeenUsed(n);
        }

        store.size.should.equal(maxSize);

        // The first 2 nonces should have been evicted (oldest)
        const hash0 = _nonceKey(nonces[0]);
        const hash1 = _nonceKey(nonces[1]);
        store.has(hash0).should.equal(false, "oldest nonce should be evicted");
        store.has(hash1).should.equal(false, "second oldest nonce should be evicted");

        // The last nonce should still be present
        const hashLast = _nonceKey(nonces[nonces.length - 1]);
        store.has(hashLast).should.equal(true, "newest nonce should still be present");
    });

    // -- replay within TTL window --------------------------------------------

    it("replaying a nonce within the TTL window should still be detected", () => {
        _setNonceCacheParameters(60_000, undefined); // 60s TTL

        const nonce = randomBytes(32);
        nonceAlreadyBeenUsed(nonce).should.equal(false, "first use");
        nonceAlreadyBeenUsed(nonce).should.equal(true, "replay within TTL");
    });

    // -- high-volume insertion -----------------------------------------------

    it("high-volume nonce insertion keeps cache bounded", () => {
        const maxSize = 50;
        _setNonceCacheParameters(undefined, maxSize);

        const store = _getNonceStore();

        // Insert one nonce first
        const firstNonce = randomBytes(32);
        nonceAlreadyBeenUsed(firstNonce).should.equal(false);

        // Insert many more nonces to push out older ones
        for (let i = 0; i < maxSize; i++) {
            nonceAlreadyBeenUsed(randomBytes(32));
        }

        store.size.should.be.belowOrEqual(maxSize, "cache must remain bounded");

        // The first nonce has been evicted
        const hash = _nonceKey(firstNonce);
        store.has(hash).should.equal(false, "first nonce should be evicted when maxSize is reached");
    });

    // -- clear ---------------------------------------------------------------

    it("clear() should reset the store", () => {
        const store = _getNonceStore();

        for (let i = 0; i < 10; i++) {
            nonceAlreadyBeenUsed(randomBytes(32));
        }
        store.size.should.equal(10);

        store.clear();
        store.size.should.equal(0, "store should be empty after clear()");
    });

    // -- constant-size key (per-entry memory is bounded) ---------------------

    it("stores a fixed-width key whatever the nonce length", () => {
        const store = _getNonceStore();

        const small = randomBytes(32);
        const large = randomBytes(1024 * 1024); // 1 MiB nonce

        nonceAlreadyBeenUsed(small);
        nonceAlreadyBeenUsed(large);

        const keys = [...store.keys()];
        keys.length.should.equal(2);
        // base64 of a 32-byte digest is always 44 characters, independent of the nonce size
        for (const key of keys) {
            key.length.should.equal(44, "each cache key should be a constant-size digest");
        }
    });

    it("still detects a replay of a large nonce", () => {
        const large = randomBytes(512 * 1024);
        nonceAlreadyBeenUsed(large).should.equal(false, "first use accepted");
        nonceAlreadyBeenUsed(large).should.equal(true, "replay detected via digest key");
    });

    it("exposes a small maximum nonce length for callers to enforce", () => {
        MAX_NONCE_LENGTH.should.be.a.Number();
        MAX_NONCE_LENGTH.should.be.aboveOrEqual(32, "must admit the 32-byte standard nonce");
        MAX_NONCE_LENGTH.should.be.belowOrEqual(256, "must stay small enough to bound pre-cache work");
    });
});
