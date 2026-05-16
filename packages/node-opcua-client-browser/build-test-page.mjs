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

// `fs` is unreachable from any browser code path but is still pulled into the
// bundle via the `node-opcua-utils` CJS barrel re-export (transitively imported
// by `node-opcua-factory` and `node-opcua-date-time`, which aren't tree-shakeable
// in CJS). Stub to an empty module so esbuild can resolve it.
const fsStub = resolve(pageDir, "node-stub.cjs");

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
        // The `"browser"` condition in `node-opcua-transport`'s `exports` map
        // routes us to its browser-safe entry, which omits `client_tcp_transport`
        // and its `node:net`/`os`/`util` imports. esbuild honours `conditions`.
        conditions: ["browser"],
        // Standalone polyfill packages (events, util, buffer, process) are devDeps
        // of this package; let transitively-bundled files in other packages
        // resolve bare imports to them.
        nodePaths: [resolve(__dirname, "node_modules")],
        // Map `node:`-prefixed built-ins to their standalone npm polyfill
        // packages. Bare `events`/`util`/`buffer`/`process` already resolve via
        // each polyfill's `"browser"` package.json field under `platform: "browser"`.
        alias: {
            "node:events": "events",
            "node:util": "util",
            "node:buffer": "buffer",
            "node:process": "process",
            // `fs` is reachable via `node-opcua-utils/check_file_exists` (pulled
            // transitively through the utils CJS barrel) but never executed at
            // runtime in the browser. Stub it.
            fs: fsStub,
            "node:fs": fsStub,
            "fs/promises": fsStub,
            "node:fs/promises": fsStub
        },
        define: {
            // some node-opcua code reads `typeof global === "object"` at module load
            global: "globalThis",
            // CJS-emitted dist files reference `__filename`/`__dirname` (e.g. via
            // `make_debugLog(__filename)`); stub with empty strings.
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
