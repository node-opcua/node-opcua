// A named entry point for this package's test helpers, so callers say
// `node-opcua-packet-analyzer/testHelpers` rather than reaching into `dist/`. Same shape as
// node-opcua-address-space/testHelpers. Internal to the monorepo: reachable, not supported API.
module.exports = require("./dist/test_helpers/index.js");
