import fs from "node:fs";
import { AddressSpace, adjustNamespaceArray, PseudoSession } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import { parse_opcua_common } from "..";
import "should";

async function createAddressSpace(nodesets: string[]): Promise<AddressSpace> {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, nodesets);
    adjustNamespaceArray(addressSpace);
    return addressSpace;
}
async function test_parse_opcua_common(nodesets: string[]) {
    const addressSpace = await createAddressSpace(nodesets);

    const pseudoSession = new PseudoSession(addressSpace);
    const _data = await parse_opcua_common(pseudoSession);

    addressSpace.dispose();
}

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { modelingFile } from "node-opcua-test-helpers";

describe("testing custom nodeset", function (this: Mocha.Suite) {
    this.timeout(Math.max(30000, this.timeout()));

    it("should parse a custom nodeset", async () => {
        const nodeset_files = [nodesets.standard, modelingFile("my_data_type.xml")];
        fs.existsSync(nodeset_files[0]).should.eql(true);
        fs.existsSync(nodeset_files[1]).should.eql(true);

        await test_parse_opcua_common(nodeset_files);
    });
});
