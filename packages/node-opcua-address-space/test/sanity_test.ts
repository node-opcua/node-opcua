import should from "should";
import * as opcua from "../dist/api/index.js";

describe("node-opcua-address-space module sanity test ", () => {
    it("module 'node-opcua-address-space' should not export any null properties", () => {
        // the namespace has no index signature; this walks it deliberately by name
        const exported = opcua as unknown as Record<string, unknown>;
        Object.keys(exported).forEach((x) => {
            should.exist(exported[x], `${x} should be defined`);
        });
    });
});
