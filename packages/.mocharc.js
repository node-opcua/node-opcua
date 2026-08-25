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
const resolve = (id) => require.resolve(id);

module.exports = {
    colors: true,
    recursive: true,
    extension: ["js", "ts"],
    require: [resolve("source-map-support/register"), resolve("tsx/cjs"), resolve("should")]
};
