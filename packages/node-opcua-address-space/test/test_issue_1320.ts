import should from "should";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-basic-types";
import { AddressSpace, Namespace } from "..";
import { generateAddressSpace } from "../distNodeJS";

describe("testing github issue https://github.com/node-opcua/node-opcua/issues/1320", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
         await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);

        namespace =  addressSpace.registerNamespace("Private");
    });

    afterEach(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should be able to instantiate component variable if it has the same name as parent objectType", () => {
        // create objectType "Test" with variable "Test"
        const objectTest = namespace.addObjectType({
            browseName: "Test"
        });
        namespace.addVariable({
            browseName: "Test",
            dataType: DataType.String,
            componentOf: objectTest,
            modellingRule: "Mandatory"
        });

        // instantiate this objectType
        const instance = objectTest.instantiate({
            browseName: "TestInstance"
        });

        // check whether variable under objectType is indeed created
        should.exist(instance?.getComponentByName("Test"), "Test is not instantiated while it is Mandatory on objectType Test");
    });
});
