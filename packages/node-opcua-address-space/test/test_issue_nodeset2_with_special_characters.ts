import "should";

import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, type UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

describe("Loading nodeset.xml with special char", () => {
    it("should load a node with special characters in the nodeId ", async () => {
        const addressSpace = AddressSpace.create();

        addressSpace.registerNamespace("http://own.company.com/my_own_namespace");

        const example = getAddressSpaceFixture("nodeset_with_special_char.xml");
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
