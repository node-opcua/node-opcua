/***
 * @module node-opcua-basic-types
 */
/**
 * return a random integer value in the range of  min inclusive and  max exclusive
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
