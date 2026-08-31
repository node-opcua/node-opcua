import fs from "node:fs";
import { DataType, randomGuid } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { getExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object/dist/get_extra_data_type_manager";
import { AttributeIds } from "node-opcua-data-model";
import { make_debugLog } from "node-opcua-debug";
import type { IBaseUAObject } from "node-opcua-factory";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { type StructureDefinition, StructureType } from "node-opcua-types";
import { Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, PseudoSession } from "..";
import { generateAddressSpace } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

const debugLog = make_debugLog("TEST");

interface DynamicExtensionObjectLike {
    toString(): string;
}
interface DynamicExtensionObjectWithPets extends IBaseUAObject {
    id: string;
    pet: { constructor: { schema: { name: string } } }[];
}

describe("Testing ExtensionObject 2017", function (this: Mocha.Suite) {
    this.timeout(20000);

    const xml = getAddressSpaceFixture("datatype_StructureWithSubtypedValues.xml");

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();

        fs.existsSync(xml).should.eql(true, `file must exist ${xml}`);
        await generateAddressSpace(addressSpace, [nodesets.standard, xml]);
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("should create an ExtensionObject with nested ExtensionObject", async () => {
        const session = new PseudoSession(addressSpace);
        const dataTypeDefinitionDataValue = await session.read({
            nodeId: "ns=1;i=1010", // PetHouseType
            attributeId: AttributeIds.DataTypeDefinition
        });
        const dataTypeDefinition = dataTypeDefinitionDataValue.value.value as StructureDefinition;

        dataTypeDefinition.structureType.should.eql(
            StructureType.StructureWithSubtypedValues,
            "should be StructureWithSubtypedValues"
        );
        should(dataTypeDefinition.fields?.length).eql(2);

        should(dataTypeDefinition.fields?.[0].name).eql("Id");
        should(dataTypeDefinition.fields?.[0].dataType?.toString()).eql("ns=0;i=14");
        should(dataTypeDefinition.fields?.[0].valueRank).eql(-1); // Scalar

        should(dataTypeDefinition.fields?.[1].name).eql("Pet");
        should(dataTypeDefinition.fields?.[1].dataType?.toString()).eql("ns=1;i=1001");
        should(dataTypeDefinition.fields?.[1].valueRank).eql(1); // OneDimension

        should(dataTypeDefinition.fields?.[1].isOptional).eql(true, "special marker for subtyped field");
    });

    it("should create a StructureWithSubtypedValues ExtensionObject", async () => {
        const session = new PseudoSession(addressSpace);

        const dataTypeManager = await getExtraDataTypeManager(session);

        const dogConstructor = dataTypeManager.getExtensionObjectConstructorFromDataType(resolveNodeId("ns=1;i=1002"))!; // DogType

        const catConstructor = dataTypeManager.getExtensionObjectConstructorFromDataType(resolveNodeId("ns=1;i=1003"))!; // CatType

        const dog = new dogConstructor({
            Breed: "Bulldog",
            IsTrained: true
        }) as unknown as DynamicExtensionObjectLike;

        const cat = new catConstructor({
            Color: "Black",
            IsIndoor: false
        }) as unknown as DynamicExtensionObjectLike;

        const StructureWithSubtypedValues = dataTypeManager.getExtensionObjectConstructorFromDataType(
            resolveNodeId("ns=1;i=1010")
        )!;

        const guid = randomGuid();
        const extObj = new StructureWithSubtypedValues({
            Id: guid,
            Pet: [dog, cat]
        }) as unknown as DynamicExtensionObjectWithPets;

        debugLog("---- ExtensionObject ----");
        debugLog(dog.toString());
        debugLog(extObj.toString());

        extObj.id.should.eql(guid);
        extObj.pet.length.should.eql(2);
        extObj.pet[0].constructor.schema.name.should.eql("DogType");
        extObj.pet[1].constructor.schema.name.should.eql("CatType");

        var size = extObj.binaryStoreSize();
        size.should.be.greaterThan(10);

        // encode the object
        var binaryStream = new BinaryStream(size);
        extObj.encode(binaryStream);

        // decode the object
        binaryStream.rewind();
        const extObj2 = new StructureWithSubtypedValues({}) as unknown as DynamicExtensionObjectWithPets;
        extObj2.decode(binaryStream);

        debugLog(extObj2.toString());

        extObj2.id.should.eql(guid);
        extObj2.pet.length.should.eql(2);
        extObj2.pet[0].constructor.schema.name.should.eql("DogType");
        extObj2.pet[1].constructor.schema.name.should.eql("CatType");

        // --- now cloning
        const variant = new Variant({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Scalar,
            value: extObj
        });
        const variant2 = variant.clone();
        variant2.dataType.should.eql(DataType.ExtensionObject);
        variant2.arrayType.should.eql(VariantArrayType.Scalar);
        const clonedValue = variant2.value as unknown as DynamicExtensionObjectWithPets;
        clonedValue.id.should.eql(guid);
        clonedValue.pet.length.should.eql(2);
        clonedValue.pet[0].constructor.schema.name.should.eql("DogType");
        clonedValue.pet[1].constructor.schema.name.should.eql("CatType");
    });
});
