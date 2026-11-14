#!/usr/bin/env node
/**
 * Backward-compatible entry point.
 *
 * The runner now lives in tools/parallel-runner (@sterfive/parallel-runner).
 * This one-liner keeps the old invocations working unchanged:
 *
 *     cd packages && node parallel_test.js [args...]
 *     node packages/parallel_test.js [args...]        # from the repo root (GitLab CI)
 *
 * It pins --root to this directory (packages/) so test discovery and the
 * cache/duration state files land exactly where they always did, regardless
 * of the current working directory. Pass --root yourself to override.
 */
if (!process.argv.slice(2).includes("--root")) {
    process.argv.push("--root", __dirname);
}

require("../tools/parallel-runner/src/cli.js");
