import * as nodesets from "node-opcua-nodesets";
import * as should from "should";

import { generateAddressSpace } from "..";
import { AddressSpace, BaseNode } from "..";

import { BoilerType, createBoilerType } from "..";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("UANode#removeReference", () => {

    const nodesetFilename = nodesets.standard_nodeset_file;
    let addressSpace: AddressSpace;
    let boilerType: BoilerType;
    before(async () => {
        addressSpace = AddressSpace.create();
        const namespace = addressSpace.registerNamespace("Private");
        namespace.index.should.eql(1);

        addressSpace.getNamespace("Private").index.should.eql(
            (addressSpace as any)._private_namespaceIndex);

        await generateAddressSpace(addressSpace, nodesetFilename);
        boilerType = createBoilerType(namespace);
    });
    after(async () => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should be possible to remove a reference ", () => {

        const boiler = boilerType.instantiate({
            browseName: "Boiler#1",
            nodeId: "ns=1;s=MyBoiler"
        });

        boiler.nodeId.toString().should.eql("ns=1;s=MyBoiler");

        const componentsBefore = boiler.getComponents().map((x: BaseNode) => x.browseName.toString());

        // xx console.log(componentsBefore.join(" "));

        componentsBefore.indexOf("1:InputPipe").should.be.aboveOrEqual(0);

        boiler.removeReference({ referenceType: "HasComponent", nodeId: boiler.inputPipe.nodeId });
        const componentsAfter = boiler.getComponents().map((x: BaseNode) => x.browseName.toString());
        // xx console.log(componentsAfter.join(" "));

        componentsAfter.indexOf("1:InputPipe").should.eql(-1);

        should.not.exist(boiler.inputPipe);

        boiler.removeReference({ referenceType: "HasComponent", nodeId: boiler.outputPipe.nodeId });
        should.not.exist(boiler.outputPipe);

    });

});
