/**
 * Build the smoke-test page for the Playwright harness.
 *
 * Produces `test/page/dist/{index.html, main.js}` from `test/page/main.ts`
 * using a minimal esbuild config. The smoke page only verifies the bundler
 * wiring end-to-end; later PRs will introduce a fuller build configuration
 * (shared with the production browser bundle) in `esbuild-config.mjs`.
 */

import * as esbuild from "esbuild";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, copyFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pageDir = resolve(__dirname, "test", "page");
const outDir = resolve(pageDir, "dist");

// Stub used in place of Node-only modules (fs, net, os) that are statically
// imported by code paths the browser bundle never executes.
const nodeStub = resolve(pageDir, "node-stub.cjs");

export async function buildTestPage(opts = {}) {
    mkdirSync(outDir, { recursive: true });

    // index.html references `./main.js`; emit the bundle under that name.
    copyFileSync(resolve(pageDir, "index.html"), resolve(outDir, "index.html"));

    await esbuild.build({
        entryPoints: [resolve(pageDir, "main.ts")],
        outfile: resolve(outDir, "main.js"),
        bundle: true,
        format: "esm",
        platform: "browser",
        target: "es2022",
        minify: false,
        sourcemap: opts.sourcemap ?? true,
        logLevel: opts.logLevel ?? "warning",
        // Standalone polyfill packages (events, util, buffer, process) are devDeps
        // of this package; let any file in the bundle (including transitive ones
        // under other packages) resolve bare imports to them.
        nodePaths: [resolve(__dirname, "node_modules")],
        // The transport-package CJS barrel re-exports `client_tcp_transport.js`,
        // whose top-level `require("node:net"|"node:os"|"node:util")` is evaluated
        // by esbuild even though the WS path never instantiates it. We alias the
        // unreachable Node-only modules to an empty stub, and route the polyfillable
        // ones to standalone browser implementations.
        alias: {
            // node: prefix variants — esbuild's `platform: "browser"` already
            // resolves bare `events`/`util`/`buffer`/`process` to their npm
            // package polyfills via the "browser" field, so only the prefixed
            // forms need explicit aliases.
            "node:events": "events",
            "node:util": "util",
            "node:buffer": "buffer",
            "node:process": "process",
            // truly Node-only, never executed in the browser bundle — empty stub
            fs: nodeStub,
            "node:fs": nodeStub,
            "fs/promises": nodeStub,
            "node:fs/promises": nodeStub,
            "node:net": nodeStub,
            "node:os": nodeStub
        },
        define: {
            // make `global` resolve to `globalThis` in browser; some node-opcua code
            // checks `typeof global === "object"` at module load.
            global: "globalThis",
            // CJS-emitted dist files reference `__filename`/`__dirname` (e.g. via
            // `make_debugLog(__filename)`); stub them with the source file path
            // strings esbuild already tracks per-module.
            __filename: '""',
            __dirname: '""'
        },
        // Make `process` and `Buffer` available as globals to every module in the
        // bundle (several transport packages use them without explicit imports).
        inject: [resolve(pageDir, "globals-shim.js")]
    });

    return outDir;
}

// CLI entry: `node build-test-page.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
    await buildTestPage({ logLevel: "info" });
    console.log(`Built test page at ${outDir}`);
}
