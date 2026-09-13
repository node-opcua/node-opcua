// Baseline mocha configuration for packages that do not ship their own .mocharc.
//
// Replaces the previous .mocharc.yml, which listed the loader as the relative path
// "../node_modules/source-map-support/register". Mocha 12 resolves `require` entries
// from its own install directory, not the working directory, so that expanded to
// mocha/lib/node_modules/source-map-support/register and every such package failed to
// start with ERR_MODULE_NOT_FOUND. A .js config can call require.resolve and hand mocha
// absolute paths, which is the only form that survives pnpm's strict layout.
//
// tsx and should are part of the baseline because the tests are TypeScript and use
// should-style assertions; without them a package with no config of its own cannot run
// its own suite at all.
//
// tsx is registered as the ESM hook (`--import tsx/esm`), not as the CommonJS one. Every
// package publishes ESM since FEAT-2, and `tsx/cjs` transpiles each test file to CommonJS
// instead, so the suites exercised a CommonJS translation of the code we ship: different
// evaluation order, different cycle behaviour, no `import.meta`, and named exports found by
// a lexer rather than declared. It also meant `require("x")` and `await import("x")` returned
// two different instances of the same module, so anything holding module-level state could
// split in two without saying so, which is the failure that cost a day in FEAT-2 batch 3.
const resolve = (id) => require.resolve(id);

module.exports = {
    colors: true,
    recursive: true,
    extension: ["js", "ts"],
    require: [resolve("source-map-support/register"), resolve("should")],
    "node-option": ["import=tsx/esm"]
};
