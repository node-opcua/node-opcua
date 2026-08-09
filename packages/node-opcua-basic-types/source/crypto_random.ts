/***
 * @module node-opcua-basic-types
 *
 * Cryptographically strong random bytes, from the one API that both runtimes agree on.
 *
 * This deliberately uses `globalThis.crypto.getRandomValues` rather than `node:crypto`:
 * node-opcua-basic-types sits at the bottom of the dependency graph and is pulled into
 * browser bundles, so it must not carry a Node built-in import that a bundler would have
 * to alias away, nor a dependency on a package whose browser entry drags in extra
 * modules. WebCrypto is a global in every browser and in Node.js since v18, so no
 * conditional export or `.browser` variant is needed here.
 */

import { createFastUninitializedBuffer } from "node-opcua-buffer-utils";

/** WebCrypto refuses more than 65536 bytes in a single getRandomValues call */
const maxBytesPerDraw = 65536;

function getCrypto(): Crypto {
    const c = globalThis.crypto;
    // c8 ignore next 6
    if (!c || typeof c.getRandomValues !== "function") {
        throw new Error(
            "[NODE-OPCUA] no cryptographically secure random source available: " +
                "globalThis.crypto.getRandomValues is missing. " +
                "A browser or Node.js 18 or later is required; refusing to fall back on Math.random()."
        );
    }
    return c;
}

/**
 * @param size number of bytes to draw
 * @returns a Buffer of `size` cryptographically strong random bytes
 */
export function cryptoRandomBytes(size: number): Buffer {
    const buffer = createFastUninitializedBuffer(size);
    const crypto = getCrypto();
    for (let offset = 0; offset < size; offset += maxBytesPerDraw) {
        const chunk = Math.min(maxBytesPerDraw, size - offset);
        // allocUnsafe hands out slices of a shared pool: the view must honour byteOffset
        crypto.getRandomValues(new Uint8Array(buffer.buffer, buffer.byteOffset + offset, chunk));
    }
    return buffer;
}
