import { coerceNodeId } from "node-opcua-nodeid";
import { AddressSpace } from "..";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("#625 automatic string nodeid assignment", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const ns1 = addressSpace.registerNamespace("namespace0");
        const ns2 = addressSpace.registerNamespace("namespace2");
        ns2.addAlias("MyAlias", coerceNodeId("ns=2;i=32"));
    });

    after(() => {
        addressSpace.dispose();
    });

    it("should resolve nodeId provided in issue #625", () => {
        const a = addressSpace.resolveNodeId("ns=1;s=5cef44f09c31dc004c8ae25a_s[test2]_Meta:O0/O0:0");
        a.toString().should.eql("ns=1;s=5cef44f09c31dc004c8ae25a_s[test2]_Meta:O0/O0:0");

        const b = addressSpace.resolveNodeId("ns=1;s=5cef44f09c31dc004c8ae25a_s[test2]_Meta:O0");
        b.toString().should.eql("ns=1;s=5cef44f09c31dc004c8ae25a_s[test2]_Meta:O0");
    });

    it("should resolve simple node id strings", () => {
        const a = addressSpace.resolveNodeId("ns=1;s=sometext");
        a.toString().should.eql("ns=1;s=sometext");
    });

    it("should resolve more complex node id strings containing special characters like / or :", () => {
        const a = addressSpace.resolveNodeId("ns=1;s=sometest[test2]_Meta:O0/O0:0");
        a.toString().should.eql("ns=1;s=sometest[test2]_Meta:O0/O0:0");
    });
    it("should resolve more complex node id strings containing special characters like ;", () => {
        const a = addressSpace.resolveNodeId("ns=1;s=hello;world@:1/2:3");
        a.toString().should.eql("ns=1;s=hello;world@:1/2:3");
    });
    it("should resolve a alias", () => {
        const a = addressSpace.resolveNodeId("2:MyAlias");
        a.toString().should.eql("ns=2;i=32");
    });
});
