// Mocha does not merge configuration files: the nearest .mocharc wins outright, so a
// package that wants one setting changed would otherwise have to restate everything.
// Spreading the shared baseline avoids that - loaders stay defined in exactly one place,
// packages/.mocharc.js, which resolves them with require.resolve.
//
// Never put a relative path in `require`. Mocha resolves those from its own install
// directory, not the working directory, so they depend on how deep the package sits and
// break under pnpm's layout. Run `pnpm run check:mocharc` after editing this file.

module.exports = {
    ...require("../.mocharc.js"),
    files: ["test/**/*.ts","test/**/*.js"],
    timeout: 50000
};
