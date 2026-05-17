/**
 * Cryptographically-strong random bytes (Node implementation).
 *
 * Re-exports `randomBytes` from `node:crypto`. The browser entry
 * (`random_bytes.browser.ts`) provides a WebCrypto-based equivalent,
 * so consumers can call `randomBytes` from `node-opcua-utils` uniformly
 * across runtimes — `node:crypto` is no longer imported at call sites
 * that need to remain browser-bundlable.
 *
 * Callers should import via the package barrel (`node-opcua-utils`),
 * not the deep path — deep-importing this file from a browser bundle
 * would defeat the conditional-exports split.
 *
 * @module node-opcua-utils
 */
export { randomBytes } from "node:crypto";
