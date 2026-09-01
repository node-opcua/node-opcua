import "should";

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

describe("Loading custom ExtensionObject from nodeset.xml", () => {
    it("should load a custom ExtensionObject", async () => {
        const addressSpace = AddressSpace.create();

        const example = getAddressSpaceFixture("example_issue1096.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, example]);

        const exampleNode = addressSpace.findNode("ns=1;i=6007") as UAVariable;
        exampleNode.browseName.toString().should.eql("1:ExampleStructureInstance");
        console.log(exampleNode.readValue().value.toString());

        addressSpace.dispose();
    });
});
