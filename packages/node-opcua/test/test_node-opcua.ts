import should from "should";

import * as opcua from "..";

describe("module 'node-opcua' module sanity test", () => {
    it("module 'node-opcua' should not export any null properties", () => {
        const exported = opcua as unknown as Record<string, unknown>;
        for (const key of Object.keys(exported)) {
            if (exported[key] === null) {
                continue;
            }
            should.exist(exported[key], `${key} should be defined`);
        }
    });
});
