import * as should from "should";
import {
    AddressSpace,
    generateAddressSpace,
    nodesets,
    //
    addExtensionObjectDataType,
    ExtensionObjectDefinition,
    StructureDefinitionOptions,
    NodeId,
    DataType,
} from "..";

describe("addExtensionObjectDataType", () => {

    const namespaceUri = "urn:name"

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const ns = addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [
            nodesets.standard
        ];
        await generateAddressSpace(addressSpace, nodesetsXML);

    });
    after(() => { addressSpace.dispose(); });
    it("should add a ExtensionObject DataType", async () => {

        const ns = addressSpace.getOwnNamespace();


        const structureDefinition: StructureDefinitionOptions = {
            baseDataType: "",
            fields: [{
                isOptional: false,
                name: "Name",
                dataType: DataType.String,
                valueRank: - 1
            }]
        };

        const options: ExtensionObjectDefinition = {
            browseName: "PersonDataType",
            description: "A Person!",
            isAbstract: false,
            structureDefinition,
            binaryEncoding: NodeId.nullNodeId,
            xmlEncoding: NodeId.nullNodeId,
        };
        const dataType = addExtensionObjectDataType(ns, options);

        dataType.binaryEncoding.browseName.toString().should.eql("Default Binary");

        console.log(ns.toNodeset2XML());
    });

})