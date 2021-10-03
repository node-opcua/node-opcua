import * as should from "should";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { AddressSpace, assert, displayNodeElement, Namespace, NodeClass, nodesets, promoteToMandatory } from "..";

import { removeDecoration } from "./test_helpers";

const namespaceUri = "urn:some";

function createModel(addressSpace: AddressSpace) {
    /* empty */
}

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("promoteToMandatory", () => {
    let addressSpace: AddressSpace;
    let nsDI: number;
    let ns: Namespace;

    before(async () => {
        addressSpace = AddressSpace.create();
        ns = addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [nodesets.standard, nodesets.di];

        await generateAddressSpace(addressSpace, nodesetsXML);
        createModel(addressSpace);

        nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        if (nsDI < 0) {
            throw new Error("Cannot find DI namespace!");
        }
    });
    after(() => {
        addressSpace.dispose();
    });

    it("when creating a sub type it should be possible to promote a component or property to mandatory", async () => {
        const deviceType = addressSpace.findObjectType("DeviceType", nsDI);
        if (!deviceType) {
            throw new Error("Cannot find DeviceType");
        }

        const boilerType = ns.addObjectType({
            browseName: "BoilerType",
            subtypeOf: deviceType
        });

        const deviceClass = promoteToMandatory(boilerType, "DeviceClass", nsDI);
        deviceClass.browseName.toString().should.eql(`${nsDI}:DeviceClass`);
        deviceClass.nodeClass.should.eql(NodeClass.Variable);
        deviceClass.modellingRule!.should.eql("Mandatory");

        const deviceHealth = promoteToMandatory(boilerType, "DeviceHealth", nsDI);
        deviceHealth.browseName.toString().should.eql(`${nsDI}:DeviceHealth`);
        deviceHealth.nodeClass.should.eql(NodeClass.Variable);
        deviceHealth.modellingRule!.should.eql("Mandatory");

        const str1 = displayNodeElement(boilerType);
        const a = removeDecoration(str1).split("\n");
        // console.log(a);

        // a[2 * 2 + 1].should.eql(`│ HasComponent Ⓥ         │ ns=1;i=1001  │ 2:DeviceHealth         │ Mandatory           │ BaseDataVariableType  │ 2:DeviceHealthEnumeration(Variant) │ null  │`);
        // a[13 * 2 + 1].should.eql(`│ HasComponent Ⓥ         │ ns=2;i=6208  │ 2:DeviceHealth         │ Optional            │ BaseDataVariableType  │ 2:DeviceHealthEnumeration(Variant) │ null  │`);
    });
});
