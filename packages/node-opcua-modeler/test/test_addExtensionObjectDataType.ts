Error.stackTraceLimit = 100000;
// tslint:disable: no-console
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as should from "should";
import { promisify } from "util";
import {
    addExtensionObjectDataType,
    AddressSpace,
    addVariableTypeForDataType,
    //
    DataType,
    ExtensionObjectDefinition,
    generateAddressSpace,
    NodeId,
    nodesets,
    StructureDefinitionOptions,
} from "..";
const writeFile = promisify(fs.writeFile);

const doDebug = false;

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("addExtensionObjectDataType", function (this: any) {

    this.timeout(10000);
    const namespaceUri = "urn:name";

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [
            nodesets.standard
        ];
        await generateAddressSpace(addressSpace, nodesetsXML);

    });
    after(() => {
        addressSpace.dispose();
    });
    it("should add an ExtensionObject DataType", async () => {

        const ns = addressSpace.getOwnNamespace();

        const structureDefinition: StructureDefinitionOptions = {
            baseDataType: "",
            fields: [{
                dataType: DataType.String,
                isOptional: false,
                name: "Name",
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
        const dataType = await addExtensionObjectDataType(ns, options);

        dataType.binaryEncoding!.browseName.toString().should.eql("Default Binary");

        // const tmpFile = await fs.promises.mkdtemp(os.tmpdir() + "test.NodeSet2.xml", "utf-8");
        const tmpFile = path.join(os.tmpdir(), "test.NodeSet2.xml");
        console.log("tmpFile =", tmpFile);

        if (doDebug) {

            const a = Object.values((ns as any)._nodeid_index);
            a.forEach((b: any) => {
                console.log(b.browseName.toString(), b.nodeId.toString(),
                    (b).typeDefinitionObj ? (
                        (b).typeDefinitionObj.browseName.toString() + " ... " + (b).typeDefinition.toString())
                        : ""); // .nodeId.tostring(), b.browseName.tostring());
            });

        }
        const xml = ns.toNodeset2XML();
        await writeFile(tmpFile, xml, "utf-8");

        const tmpCSVFile = path.join(os.tmpdir(), "test.NodeSet2.csv");
        const csv = (ns as any)._nodeIdManager.getSymbolCSV();
        await writeFile(tmpCSVFile, csv, "utf-8");

        // should be possible to create o bject
        const o = addressSpace.constructExtensionObject(dataType, { name: "JoeDoe" });

        if (doDebug) {
            console.log("symbol =");
            console.log(csv);
        }
        // xx fix me await test_back(tmpFile);
        async function testReloadGeneratedNodeset() {
            const addressSpace2 = AddressSpace.create();
            const namespace = addressSpace2.registerNamespace(namespaceUri);
            const nodesetsXML = [
                nodesets.standard,
                tmpFile
            ];
            await generateAddressSpace(addressSpace2, nodesetsXML);

            const nsIndex = addressSpace2.getNamespaceIndex("urn:name");
            nsIndex.should.eql(1);
            const personDataType = addressSpace2.findDataType("PersonDataType", nsIndex)!;
            const v = namespace.addVariable({
                browseName: "Var1",
                dataType: personDataType.nodeId,
                propertyOf: addressSpace2.rootFolder.objects.server,
            });

            const person = addressSpace2.constructExtensionObject(personDataType, {
                name: "Joe Doe"
            });
            person.constructor.name.should.eql("PersonDataType");
            v.setValueFromSource({ dataType: DataType.ExtensionObject, value: person });
            addressSpace2.dispose();
        }

        await testReloadGeneratedNodeset();
    });

});
describe("addVariableTypeForDataType", function (this: any) {

    this.timeout(10000);
    const namespaceUri = "urn:name";

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [
            nodesets.standard
        ];
        await generateAddressSpace(addressSpace, nodesetsXML);

    });
    after(() => {
        addressSpace.dispose();
    });
    it("ZZZE should addVariableTypeForDataType", async () => {

        const ns = addressSpace.getOwnNamespace();

        const buildInfoStructureDefinition: StructureDefinitionOptions = {
            baseDataType: "",
            fields: [
                {
                    arrayDimensions: [],
                    dataType: DataType.String,
                    isOptional: false,
                    name: "ProductUri",
                    valueRank: 0,
                },
                {
                    arrayDimensions: [],
                    dataType: DataType.String,
                    isOptional: false,
                    name: "ManufacturerName",
                    valueRank: 0,
                },
                {
                    arrayDimensions: [],
                    dataType: DataType.String,
                    isOptional: false,
                    name: "ProductName",
                    valueRank: 0,
                },
                {
                    arrayDimensions: [],
                    dataType: DataType.String,
                    isOptional: false,
                    name: "SoftwareVersion",
                    valueRank: 0,
                },
                {
                    arrayDimensions: [],
                    dataType: DataType.String,
                    isOptional: false,
                    name: "BuildNumber",
                    valueRank: 0,
                },
                {
                    arrayDimensions: [],
                    dataType: DataType.DateTime,
                    isOptional: false,
                    name: "BuildDate",
                    valueRank: 0,
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

        console.log("AAAAAAAA");
        const serverStatusStructureDefinition: StructureDefinitionOptions = {
            baseDataType: "",
            fields: [
                {
                    arrayDimensions: [],
                    dataType: DataType.DateTime,
                    isOptional: false,
                    name: "StartTime",
                    valueRank: 0,
                },
                {
                    arrayDimensions: [],
                    dataType: addressSpace.findDataType("UtcTime")!.nodeId,
                    isOptional: false,
                    name: "CurrentTime",
                    valueRank: 0,
                },
                {
                    arrayDimensions: [],
                    dataType: buildInfoDataType.nodeId,
                    isOptional: false,
                    name: "BuildInfo",
                    valueRank: 0,
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
        console.log("BBBBBBBBB");

        const buildInfoType = addVariableTypeForDataType(ns, buildInfoDataType);
        const serverStatusType = addVariableTypeForDataType(ns, serverStatusDataType);

        const tmpFile = path.join(os.tmpdir(), "test1.NodeSet2.xml");
        const tmpCSVFile = path.join(os.tmpdir(), "test1.NodeSet2.csv");
        console.log("tmpFile =", tmpFile);

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
        console.log("e.", e.toString());
        console.log("statusType.", statusType.toString());


    });
});
