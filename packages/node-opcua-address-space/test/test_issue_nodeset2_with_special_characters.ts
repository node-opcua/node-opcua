import * as path from "path";
import "should";

import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Loading nodeset.xml with special char", () => {
    it("should load a custom ExtensionObject", async () => {
        const addressSpace = AddressSpace.create();

        const example = path.join(__dirname, "../test_helpers/test_fixtures/nodeset_with_special_char.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, example]);

        {
            const nodeId = 'ns=3;s="Systest_Datenaustausch"';
            const exampleNode = addressSpace.findNode(nodeId) as UAVariable;
            exampleNode.browseName.toString().should.eql("3:Systest_Datenaustausch");
            // console.log(exampleNode ? exampleNode.toString() : "<Not Found>");
        }
        {
            const nodeId = 'ns=3;s="Systest_Datenaustausch"."Systest_Daten"';
            const exampleNode = addressSpace.findNode(nodeId) as UAVariable;
            exampleNode.browseName.toString().should.eql("3:Systest_Daten");
           //   console.log(exampleNode ? exampleNode.toString() : "<Not Found>");
        }
        addressSpace.dispose();
    });
});
