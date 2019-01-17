import * as should from "should";

import { getMiniAddressSpace } from "../";

import { AddressSpace } from "..";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue https://github.com/node-opcua/node-opcua/issues/432", () => {

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(async () => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should be possible to specify a custom nodeId when creating an object type", () => {

        // assuming that the namspace exist !!!
        const ns2 = addressSpace.registerNamespace("N2");
        const ns3 = addressSpace.registerNamespace("N3");
        const ns4 = addressSpace.registerNamespace("N4");
        const ns5 = addressSpace.registerNamespace("N5");
        const ns6 = addressSpace.registerNamespace("N6");
        addressSpace.getNamespaceArray().length.should.be.greaterThan(4);
        const customObjectType = ns4.addObjectType({
            browseName: "MyCustomType",
            nodeId: "i=42"
        });
        customObjectType.nodeId.toString().should.eql("ns=4;i=42");
    });
});
