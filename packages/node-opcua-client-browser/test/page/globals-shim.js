// Inject `process` and `Buffer` as globals for the browser bundle.
// Several transport-chain packages call `process.env.…`, `process.hrtime`,
// or use `Buffer` without importing them. esbuild's `inject` runs this once
// at bundle entry so every module sees the globals as if running on Node.
import processPolyfill from "process";
import { Buffer as BufferPolyfill } from "buffer";

if (typeof globalThis.process === "undefined") {
    globalThis.process = processPolyfill;
}
if (typeof globalThis.Buffer === "undefined") {
    globalThis.Buffer = BufferPolyfill;
}
