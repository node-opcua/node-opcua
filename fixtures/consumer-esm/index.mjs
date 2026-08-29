/**
 * ESM consumer smoke test.
 *
 * The mirror of consumer-cjs. Today this resolves to the CommonJS build and works through
 * Node's interop, where named exports depend on cjs-module-lexer statically finding them.
 * After the migration it resolves to real ESM and the names are declared. Both must work,
 * and the point of having this fixture from the first commit is that the day the entry
 * point flips, the difference shows up here rather than in someone's application.
 *
 * Run: node fixtures/consumer-esm/index.mjs
 */

import assert from "node:assert/strict";

import { OPCUAClient, NodeId, resolveNodeId, StatusCodes, DataType } from "node-opcua";

// A named import that cannot be resolved is a load-time error, so reaching this line
// already proves more than the CJS fixture does at the equivalent point.
for (const [name, value] of Object.entries({ OPCUAClient, NodeId, resolveNodeId, StatusCodes, DataType })) {
    assert.ok(value !== undefined, `named export ${name} resolved to undefined`);
}
assert.equal(typeof OPCUAClient.create, "function", "OPCUAClient.create must be callable");

// Same identity check as the CJS side. If the two fixtures ever disagree here, the graph
// is being loaded twice and instanceof is no longer trustworthy across packages.
const nodeId = resolveNodeId("ns=0;i=85");
assert.ok(nodeId instanceof NodeId, "resolveNodeId must return an instance of the exported NodeId class");
assert.equal(nodeId.value, 85);
assert.equal(StatusCodes.Good.value, 0);
assert.equal(DataType.Double, 11);

console.log(`consumer-esm: ok (node ${process.version})`);
