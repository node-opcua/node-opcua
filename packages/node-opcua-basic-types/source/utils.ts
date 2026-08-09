/***
 * @module node-opcua-basic-types
 */
/**
 * return a random integer in [min, max[ — min included, max EXCLUDED.
 *
 * The exclusive upper bound is deliberate and matches `Math.random()`: it is what makes
 * `getRandomInt(0, 26)` the right way to pick one of 26 letters. When the bound is a value
 * that must itself be reachable — the largest value of an integer type, typically — use
 * {@link getRandomIntInclusive} instead, otherwise the maximum is silently never produced.
 *
 * ⚠️ NOT CRYPTOGRAPHICALLY SECURE. This is backed by Math.random(), which V8 implements
 * with xorshift128+: its internal state is recoverable from a short run of observed
 * outputs, after which every past and future value is predictable. It exists to feed
 * the fuzzing helpers of this module (randomByteString, randomString, randomUInt32, ...)
 * and must never produce a value that has to be unguessable — a token, a nonce, a
 * session identifier. Use `cryptoRandomBytes` for those, or `randomGuid` which is
 * built on it.
 *
 * @param min
 * @param max
 * @return {*}
 * @private
 */
export function getRandomInt(min: number, max: number): number {
    // note : Math.random() returns a random number between 0 (inclusive) and 1 (exclusive):
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * return a random integer in [min, max] — both bounds included.
 *
 * This is the one to use to cover the full range of an integer type, e.g.
 * `getRandomIntInclusive(-0x80, 0x7f)` for an Int8: every value the type can hold,
 * boundaries included, so a round-trip test actually exercises them.
 *
 * ⚠️ NOT CRYPTOGRAPHICALLY SECURE — see {@link getRandomInt}.
 *
 * @private
 */
export function getRandomIntInclusive(min: number, max: number): number {
    return getRandomInt(min, max + 1);
}
