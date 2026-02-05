import "should";
import fs from "fs";
import path from "path";
import { nodesets } from "node-opcua-nodesets";
import { StructureDefinition, StructureType } from "node-opcua-types";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { AttributeIds } from "node-opcua-data-model";
import { AddressSpace, PseudoSession } from "..";
import { generateAddressSpace } from "../nodeJS";
import { getExtraDataTypeManager } from "node-opcua-client-dynamic-extension-object/dist/get_extra_data_type_manager";
import { resolveNodeId } from "node-opcua-nodeid";
import { DataType, randomGuid } from "node-opcua-basic-types";
import { BinaryStream } from "node-opcua-binary-stream";
import { Variant, VariantArrayType } from "node-opcua-variant";


import { make_debugLog } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");

describe("Testing ExtensionObject 2017", function (this: Mocha.Suite) {

    this.timeout(20000);

    const xml = path.join(__dirname,
        "../test_helpers/test_fixtures/datatype_StructureWithSubtypedValues.xml");


    let addressSpace: AddressSpace;
    before(async () => {


        addressSpace = AddressSpace.create();

        fs.existsSync(xml).should.eql(true, "file must exist " + xml);
        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            xml
        ]);
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


        dataTypeDefinition.structureType.should.eql(StructureType.StructureWithSubtypedValues, "should be StructureWithSubtypedValues");
        dataTypeDefinition.fields!.length.should.eql(2);

        dataTypeDefinition.fields![0].name!.should.eql("Id");
        dataTypeDefinition.fields![0].dataType!.toString().should.eql("ns=0;i=14");
        dataTypeDefinition.fields![0].valueRank!.should.eql(-1); // Scalar


        dataTypeDefinition.fields![1].name!.should.eql("Pet");
        dataTypeDefinition.fields![1].dataType!.toString().should.eql("ns=1;i=1001");
        dataTypeDefinition.fields![1].valueRank!.should.eql(1); // OneDimension

        dataTypeDefinition.fields![1].isOptional!.should.eql(true, "special marker for subtyped field");

    });

    it("should create a StructureWithSubtypedValues ExtensionObject", async () => {
        const session = new PseudoSession(addressSpace);

        const dataTypeManager = await getExtraDataTypeManager(session);

        const dogConstructor = dataTypeManager.getExtensionObjectConstructorFromDataType(resolveNodeId("ns=1;i=1002"))!; // DogType

        const catConstructor = dataTypeManager.getExtensionObjectConstructorFromDataType(resolveNodeId("ns=1;i=1003"))!; // CatType

        const dog = new dogConstructor({
            Breed: "Bulldog",
            IsTrained: true

        }) as any;


        const cat = new catConstructor({
            Color: "Black",
            IsIndoor: false

        }) as any;



        const StructureWithSubtypedValues = dataTypeManager.getExtensionObjectConstructorFromDataType(resolveNodeId("ns=1;i=1010"))!;

        const guid = randomGuid();
        const extObj = new StructureWithSubtypedValues({
            Id: guid,
            Pet: [
                dog,
                cat
            ]
        });

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
        const extObj2 = new StructureWithSubtypedValues({});
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
        (variant2.value as any).id.should.eql(guid);
        (variant2.value as any).pet.length.should.eql(2);
        (variant2.value as any).pet[0].constructor.schema.name.should.eql("DogType");
        (variant2.value as any).pet[1].constructor.schema.name.should.eql("CatType");

    });
});
