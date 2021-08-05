const { assert } = require("node-opcua-assert");
const path = require("path");
const fs = require("fs");

const {
    AddressSpace, adjustNamespaceArray,
} = require("node-opcua-address-space");
const { generateAddressSpace } = require("node-opcua-address-space/nodeJS");

const { PseudoSession } = require("node-opcua-address-space");
const { parse_opcua_common } = require("..");
const { nodesets } = require("node-opcua-nodesets");
const should = require("should");

async function createAddressSpace(nodesets/*: string[]*/)/*: AddressSpace */
{
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, nodesets);
    adjustNamespaceArray(addressSpace);
    return addressSpace;
}
async function test_parse_opcua_common(nodesets) {

    const addressSpace = await createAddressSpace(nodesets);

    const pseudoSession = new PseudoSession(addressSpace);
    const data = await parse_opcua_common(pseudoSession);

    addressSpace.dispose();
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing custom nodeset", function() {

    this.timeout(Math.max(30000, this.timeout()));

    it("should parse a custom nodeset", async () => {

        const nodeset_files = [
            nodesets.standard,
            path.join(__dirname, "../../../modeling/my_data_type.xml")
        ];
        fs.existsSync(nodeset_files[0]).should.eql(true);
        fs.existsSync(nodeset_files[1]).should.eql(true);

        await test_parse_opcua_common(nodeset_files);
    });

});
