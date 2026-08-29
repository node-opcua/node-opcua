/**
 * CommonJS consumer smoke test.
 *
 * This is the shape the overwhelming majority of node-opcua users have, and the shape the
 * ESM migration must not break. Node 22.12 and later can require() an ES module, which is
 * the whole reason the migration can be ESM-only rather than dual, but that interop is
 * conditional: a graph containing top-level await cannot be required at all. This fixture
 * is what notices, on the matrix, rather than a consumer noticing in production.
 *
 * Run: node fixtures/consumer-cjs/index.cjs
 */

const assert = require("node:assert/strict");

const opcua = require("node-opcua");

// 1. the module loaded at all. Under a half-migrated graph this is where
//    ERR_REQUIRE_ASYNC_MODULE would land.
assert.ok(opcua && typeof opcua === "object", "require('node-opcua') must return the namespace");

// 2. named exports survive. CJS today, and after the flip they come from
//    cjs-module-lexer reading the ESM entry - which is exactly the step that can
//    silently drop names.
const { OPCUAClient, NodeId, resolveNodeId, StatusCodes, DataType } = opcua;
for (const [name, value] of Object.entries({ OPCUAClient, NodeId, resolveNodeId, StatusCodes, DataType })) {
    assert.ok(value !== undefined, `named export ${name} is missing from require('node-opcua')`);
}
assert.equal(typeof OPCUAClient.create, "function", "OPCUAClient.create must be callable");

// 3. usable, not merely present: build a value and check its identity.
//    resolveNodeId lives in node-opcua-nodeid, so an instanceof that holds here proves the
//    class reaching the consumer is the same class the graph constructed internally. That
//    is the dual-package hazard this migration deliberately avoids, and the reason we
//    rejected dual publishing: 725 instanceof checks would start returning false.
const nodeId = resolveNodeId("ns=0;i=85");
assert.ok(nodeId instanceof NodeId, "resolveNodeId must return an instance of the exported NodeId class");
assert.equal(nodeId.value, 85);
assert.equal(StatusCodes.Good.value, 0);
assert.equal(DataType.Double, 11);

console.log(`consumer-cjs: ok (node ${process.version})`);
