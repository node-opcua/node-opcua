// A named entry point for this package's test helpers, so callers say
// `node-opcua-transport/testHelpers` rather than reaching into `dist/`. Same shape as
// node-opcua-address-space/testHelpers. Internal to the monorepo: reachable, not supported API.
export * from "./dist/test-fixtures/index.js";
