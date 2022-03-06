import * as path from "path";
import "should";

import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Loading nodeset.xml with special char", () => {
    it("should load a node with special characters in the nodeId ", async () => {
        const addressSpace = AddressSpace.create();
        
        addressSpace.registerNamespace("http://own.company.com/my_own_namespace");

        const example = path.join(__dirname, "../test_helpers/test_fixtures/nodeset_with_special_char.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, example]);

        {
            const nodeId = 'ns=2;s="Systest_Datenaustausch"';
            const exampleNode = addressSpace.findNode(nodeId) as UAVariable;
            exampleNode.browseName.toString().should.eql("2:Systest_Datenaustausch");
            // console.log(exampleNode ? exampleNode.toString() : "<Not Found>");
        }
        {
            const nodeId = 'ns=2;s="Systest_Datenaustausch"."Systest_Daten"';
            const exampleNode = addressSpace.findNode(nodeId) as UAVariable;
            exampleNode.browseName.toString().should.eql("2:Systest_Daten");
            //   console.log(exampleNode ? exampleNode.toString() : "<Not Found>");
        }
        addressSpace.dispose();
    });
});
