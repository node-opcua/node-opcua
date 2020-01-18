import {
    AddressSpace,
    generateAddressSpace,
    promoteToMandatory,
    displayNodeElement,
    nodesets,
} from "..";
import { removeDecoration } from "./test_helpers";

const namespaceUri = "urn:some";

function createModel(addressSpace: AddressSpace) {

}

describe("promoteToMandatory", () => {
    it("when creating a sub type it should be possible to promote a component or property to mandatoru", async () => {

        const addressSpace = AddressSpace.create();
        const ns = addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [
            nodesets.standard,
            nodesets.di
        ];

        await generateAddressSpace(addressSpace, nodesetsXML);
        createModel(addressSpace);

        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        if (nsDI < 0) {
            throw new Error("Cannot find DI namespace!");
        }

        const deviceType = addressSpace.findObjectType("DeviceType", nsDI);
        if (!deviceType) {
            throw new Error("Cannot find DevieType");
        }

        const boilerType = ns.addObjectType({
            browseName: "BoilerType",
            subtypeOf: deviceType,
        });

        promoteToMandatory(boilerType, "DeviceHealth", nsDI);

        const str1 = displayNodeElement(boilerType);
        const a = removeDecoration(str1).split("\n");
        a[2 * 2 + 1].should.eql(`│ HasComponent Ⓥ         │ ns=1;i=1001  │ 2:DeviceHealth         │ Mandatory           │ BaseDataVariableType  │ 2:DeviceHealthEnumeration(Variant) │ null  │`);
        a[13 * 2 + 1].should.eql(`│ HasComponent Ⓥ         │ ns=2;i=6208  │ 2:DeviceHealth         │ Optional            │ BaseDataVariableType  │ 2:DeviceHealthEnumeration(Variant) │ null  │`);


    })
})