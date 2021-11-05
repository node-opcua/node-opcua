Error.stackTraceLimit = 100000;
// tslint:disable: no-console
import * as fs from "fs";
// node 14 onward : import {  writeFile } from "fs/promises";
const { writeFile } = fs.promises;

import * as os from "os";
import * as path from "path";
import * as should from "should";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import {
    addExtensionObjectDataType,
    AddressSpace,
    addVariableTypeForDataType,
    //
    DataType,
    ExtensionObjectDefinition,
    NodeId,
    nodesets,
    StructureDefinitionOptions
} from "..";

const doDebug = false;

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("addExtensionObjectDataType", function (this: any) {
    this.timeout(10000);
    const namespaceUri = "http://sterfive.org/UA/Demo/";

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [nodesets.standard];
        await generateAddressSpace(addressSpace, nodesetsXML);
    });
    after(() => {
        addressSpace.dispose();
    });
    it("ZZZE-1 should add an ExtensionObject DataType", async () => {
        const ns = addressSpace.getOwnNamespace();
        // xx console.log("ns", ns.namespaceUri);

        const structureDefinition: StructureDefinitionOptions = {
            baseDataType: "",
            fields: [
                {
                    dataType: DataType.String,
                    description: "the name",
                    isOptional: false,
                    name: "Name",
                    valueRank: -1
                },
                {
                    arrayDimensions: [1],
                    dataType: DataType.Float,
                    description: "the list of values",
                    name: "Values",
                    valueRank: 1
                }
            ]
        };

        const options: ExtensionObjectDefinition = {
            browseName: "PersonDataType",
            description: "A Person!",
            isAbstract: false,
            structureDefinition,

            binaryEncoding: NodeId.nullNodeId,
            xmlEncoding: NodeId.nullNodeId
        };
        const dataType = await addExtensionObjectDataType(ns, options);

        dataType.binaryEncoding!.browseName.toString().should.eql("Default Binary");

        // const tmpFile = await fs.promises.mkdtemp(os.tmpdir() + "test.NodeSet2.xml", "utf-8");
        const tmpFile = path.join(os.tmpdir(), "test.NodeSet2.xml");
        console.log("tmpFile =", tmpFile);

        // istanbul ignore next
        if (doDebug) {
            (ns as any).nodeIterator().forEach((b: any) => {
                console.log(
                    b.browseName.toString(),
                    b.nodeId.toString(),
                    b.typeDefinitionObj ? b.typeDefinitionObj.browseName.toString() + " ... " + b.typeDefinition.toString() : ""
                ); // .nodeId.toString(), b.browseName.toString());
            });
        }

        const xml = ns.toNodeset2XML();
        await writeFile(tmpFile, xml, "utf-8");

        const tmpCSVFile = path.join(os.tmpdir(), "test.NodeSet2.csv");
        const csv = (ns as any)._nodeIdManager.getSymbolCSV();
        await writeFile(tmpCSVFile, csv, "utf-8");

        // should be possible to create object
        const o = addressSpace.constructExtensionObject(dataType, { name: "JoeDoe" });

        if (doDebug) {
            console.log("symbol =");
            console.log(csv);
        }
        // xx fix me await test_back(tmpFile);
        async function testReloadGeneratedNodeset() {
            const addressSpace2 = AddressSpace.create();
            const namespace = addressSpace2.registerNamespace(namespaceUri);
            const nodesetsXML = [nodesets.standard, tmpFile];
            await generateAddressSpace(addressSpace2, nodesetsXML);

            const nsIndex = addressSpace2.getNamespaceIndex(namespaceUri);
            nsIndex.should.eql(1);
            const personDataType = addressSpace2.findDataType("PersonDataType", nsIndex)!;
            const v = namespace.addVariable({
                browseName: "Var1",
                dataType: personDataType.nodeId,
                propertyOf: addressSpace2.rootFolder.objects.server
            });

            const person = addressSpace2.constructExtensionObject(personDataType, {
                name: "Joe Doe"
            });
            person.constructor.name.should.eql("PersonDataType");
            v.setValueFromSource({ dataType: DataType.ExtensionObject, value: person });
            addressSpace2.dispose();
        }

        await testReloadGeneratedNodeset();

        /*
        // make sure that bsd is correct
        const dataTypeDictionary = getDataTypeDictionary(ns);
        const bsd = dataTypeDictionary.readValue().value.value.toString();
        
        // xx console.log(bsd);
        bsd.should.eql(
            `<?xml version="1.0"?>
<opc:TypeDictionary xmlns:opc="http://opcfoundation.org/BinarySchema/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ua="http://opcfoundation.org/UA/" xmlns:n1="http://sterfive.org/UA/Demo/" DefaultByteOrder="LittleEndian" TargetNamespace="http://sterfive.org/UA/Demo/">
    <opc:StructuredType Name="PersonDataType" BaseType="ua:ExtensionObject">
        <opc:Field Name="Name" TypeName="opc:String"/>
        <opc:Field Name="NoOfValues" TypeName="opc:Int32"/>
        <opc:Field Name="Values" TypeName="opc:Float" LengthField="NoOfValues"/>
    </opc:StructuredType>
</opc:TypeDictionary>`
        );
*/
    });
});
describe("addVariableTypeForDataType", function (this: any) {
    this.timeout(10000);
    const namespaceUri = "urn:name";

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [nodesets.standard];
        await generateAddressSpace(addressSpace, nodesetsXML);
    });
    after(() => {
        addressSpace.dispose();
    });
    it("ZZZE-2 should addVariableTypeForDataType", async () => {
        const ns = addressSpace.getOwnNamespace();

        const buildInfoStructureDefinition: StructureDefinitionOptions = {
            baseDataType: "Structure",
            fields: [
                {
                    arrayDimensions: null,
                    dataType: DataType.String,
                    isOptional: false,
                    name: "ProductUri",
                    valueRank: -1
                },
                {
                    arrayDimensions: null,
                    dataType: DataType.String,
                    isOptional: false,
                    name: "ManufacturerName",
                    valueRank: -1
                },
                {
                    arrayDimensions: [],
                    dataType: DataType.String,
                    isOptional: false,
                    name: "ProductName",
                    valueRank: -1
                },
                {
                    arrayDimensions: [],
                    dataType: DataType.String,
                    isOptional: false,
                    name: "SoftwareVersion",
                    valueRank: -1
                },
                {
                    arrayDimensions: [],
                    dataType: DataType.String,
                    isOptional: false,
                    name: "BuildNumber",
                    valueRank: -1
                },
                {
                    arrayDimensions: [],
                    dataType: DataType.DateTime,
                    isOptional: false,
                    name: "BuildDate",
                    valueRank: -1
                }
            ]
        };

        const buildInfoOptions: ExtensionObjectDefinition = {
            browseName: "MyBuildInfoDataType",
            description: "Some BuildInfo",
            isAbstract: false,
            structureDefinition: buildInfoStructureDefinition
        };
        const buildInfoDataType = await addExtensionObjectDataType(ns, buildInfoOptions);

        const serverStatusStructureDefinition: StructureDefinitionOptions = {
            baseDataType: "Structure",
            fields: [
                {
                    arrayDimensions: [],
                    dataType: DataType.DateTime,
                    isOptional: false,
                    name: "StartTime",
                    valueRank: -1
                },
                {
                    arrayDimensions: [],
                    dataType: addressSpace.findDataType("UtcTime")!.nodeId,
                    isOptional: false,
                    name: "CurrentTime",
                    valueRank: -1
                },
                {
                    arrayDimensions: [],
                    dataType: buildInfoDataType.nodeId,
                    isOptional: false,
                    name: "BuildInfo",
                    valueRank: -1
                }
            ]
        };
        const serverStatusOptions: ExtensionObjectDefinition = {
            browseName: "MyServerStatusDataType",
            description: "....",
            isAbstract: false,
            structureDefinition: serverStatusStructureDefinition
        };
        const serverStatusDataType = await addExtensionObjectDataType(ns, serverStatusOptions);

        const buildInfoType = addVariableTypeForDataType(ns, buildInfoDataType);
        const serverStatusType = addVariableTypeForDataType(ns, serverStatusDataType);

        const tmpFile = path.join(os.tmpdir(), "test1.NodeSet2.xml");
        const tmpCSVFile = path.join(os.tmpdir(), "test1.NodeSet2.csv");
        // xx console.log("tmpFile =", tmpFile);

        const xml = ns.toNodeset2XML();
        await writeFile(tmpFile, xml, "utf-8");

        const csv = (ns as any)._nodeIdManager.getSymbolCSV();
        await writeFile(tmpCSVFile, csv, "utf-8");

        const statusType = serverStatusType.instantiate({
            browseName: "Test",
            organizedBy: addressSpace.rootFolder.objects.server
        }) as any;
        should.exist(statusType.startTime);
        const e = statusType.readValue().value.value;
        should.exist(e.startTime);
        // xx console.log("e.", e.toString());
        // xx console.log("statusType.", statusType.toString());

        /*
        // make sure that bsd is correct
        const dataTypeDictionary = getDataTypeDictionary(ns);
        const bsd = dataTypeDictionary.readValue().value.value.toString();
        // xx console.log(bsd);
        bsd.should.eql(
            `<?xml version="1.0"?>
<opc:TypeDictionary xmlns:opc="http://opcfoundation.org/BinarySchema/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ua="http://opcfoundation.org/UA/" xmlns:n1="urn:name" DefaultByteOrder="LittleEndian" TargetNamespace="urn:name">
    <opc:StructuredType Name="MyBuildInfoDataType" BaseType="ua:ExtensionObject">
        <opc:Field Name="ProductUri" TypeName="opc:String"/>
        <opc:Field Name="ManufacturerName" TypeName="opc:String"/>
        <opc:Field Name="ProductName" TypeName="opc:String"/>
        <opc:Field Name="SoftwareVersion" TypeName="opc:String"/>
        <opc:Field Name="BuildNumber" TypeName="opc:String"/>
        <opc:Field Name="BuildDate" TypeName="opc:DateTime"/>
    </opc:StructuredType>
    <opc:StructuredType Name="MyServerStatusDataType" BaseType="ua:ExtensionObject">
        <opc:Field Name="StartTime" TypeName="opc:DateTime"/>
        <opc:Field Name="CurrentTime" TypeName="ua:UtcTime"/>
        <opc:Field Name="BuildInfo" TypeName="n1:MyBuildInfoDataType"/>
    </opc:StructuredType>
</opc:TypeDictionary>`
        );
        */
    });
});
