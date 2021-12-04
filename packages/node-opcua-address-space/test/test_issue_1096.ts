import * as path from "path";
import "should";

import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, UAVariable } from "..";
import { generateAddressSpace} from "../nodeJS"

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Loading custom ExtensionObject from nodeset.xml", () => {
    it("should load a custom ExtensionObject", async () => {
        const addressSpace = AddressSpace.create();

        const example = path.join(__dirname, "../test_helpers/test_fixtures/example_issue1096.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, example]);

        const exampleNode = addressSpace.findNode("ns=1;i=6007") as UAVariable;
        exampleNode.browseName.toString().should.eql("1:ExampleStructureInstance");
        console.log(exampleNode.readValue().value.toString());

        addressSpace.dispose();
    });
});
