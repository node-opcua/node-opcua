/**
 * Cryptographically-strong random bytes (browser implementation).
 *
 * Uses the Web Crypto API's `crypto.getRandomValues()`, which is a
 * CSPRNG available in all modern browsers and in Node ≥ 18 (where it's
 * also available, so this implementation is portable should the Node
 * entry ever route here).
 *
 * `crypto.getRandomValues()` is spec-limited to 65536 bytes per call,
 * so we chunk for larger sizes (the OPC UA call sites today request
 * 16–32 bytes for nonces; the loop is purely defensive).
 *
 * Returns a Node-compatible `Buffer`. Browser bundles must provide a
 * `Buffer` polyfill (the `node-opcua-client-browser` smoke-test bundle
 * already shims one via `globals-shim.js`).
 *
 * @module node-opcua-utils/browser
 */
export function randomBytes(size: number): Buffer {
    const out = Buffer.alloc(size);
    const chunkSize = 65536;
    for (let offset = 0; offset < size; offset += chunkSize) {
        const view = new Uint8Array(out.buffer, out.byteOffset + offset, Math.min(chunkSize, size - offset));
        globalThis.crypto.getRandomValues(view);
    }
    return out;
}
