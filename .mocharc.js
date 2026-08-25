// Root mocha configuration, inherited by every package that runs `mocha` from its own
// directory (`pnpm -r run test`).
//
// Two things here are deliberate:
//
// 1. require.resolve(), not bare module names. Mocha 12 loads `require` entries through
//    its own ESM helper, which resolves them relative to mocha's install directory
//    rather than the working directory. Under pnpm's strict node_modules layout nothing
//    is visible from there, so bare names fail with ERR_MODULE_NOT_FOUND pointing at
//    `mocha/lib/node_modules/...`. Resolving here - this file is evaluated from the repo
//    root, where all three are reachable - hands mocha absolute paths instead.
//
// 2. tsx, not ts-node. The repo moved to tsx some time ago and ts-node is no longer a
//    dependency at all, so this entry had been naming a package that is not installed.
//    Nothing noticed because CI runs run_all_mocha_tests.js, which builds its Mocha
//    instance programmatically and never reads this file - only per-package runs did,
//    and those were broken.
module.exports = {
    require: [require.resolve("source-map-support/register"), require.resolve("tsx/cjs"), require.resolve("should")],
    timeout: 20000,
    extension: ["js", "ts"],
    bail: true
};
