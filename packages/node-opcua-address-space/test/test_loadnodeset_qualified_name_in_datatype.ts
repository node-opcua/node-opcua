import fs from "node:fs";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, type UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

const _debugLog = make_debugLog("TEST");
const _doDebug = checkDebugFlag("TEST");

describe("testing NodeSet XML file loading special data structure", function (this: Mocha.Context) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    beforeEach(() => {
        addressSpace = AddressSpace.create();
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("should load a nodeset xml file", async () => {
        const xml_file = getAddressSpaceFixture("dataType_with_qualifiedname.xml");

        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file]);

        const node = addressSpace.findNode("ns=1;i=1001") as UAVariable;

        should.exist(node);

        console.log(node.toString());
    });
});
