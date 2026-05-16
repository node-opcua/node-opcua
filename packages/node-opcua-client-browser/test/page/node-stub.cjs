// Empty stub used in place of the `fs` Node built-in in the browser bundle.
//
// `fs` is unreachable from any browser code path but is still pulled in via the
// `node-opcua-utils` CJS barrel (`check_file_exists.js` does `require("fs")` at
// module load). The barrel is re-exported by `node-opcua-factory` and
// `node-opcua-date-time` and CJS isn't tree-shakeable, so the import survives
// to bundle time. The runtime never calls anything on this object.
module.exports = {};
