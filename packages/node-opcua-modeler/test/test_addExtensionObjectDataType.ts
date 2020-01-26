// tslint:disable: no-console
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as should from "should";
import { promisify } from "util";
import {
    addExtensionObjectDataType,
    AddressSpace,
    DataType,
    //
    ExtensionObjectDefinition,
    generateAddressSpace,
    NodeId,
    nodesets,
    StructureDefinitionOptions,
} from "..";
const writeFile = promisify(fs.writeFile);

/**
 *
 * @param tmpFile
 */
async function test_back(tmpFile: string) {

    const addressSpace = AddressSpace.create();
    const ns2 = addressSpace.registerNamespace("Private");
    const nodesetsXML = [
        nodesets.standard,
        tmpFile,
    ];

    try {

        await generateAddressSpace(addressSpace, nodesetsXML);

        const ns = addressSpace.getNamespaceIndex("urn:name");
        if (ns === -1) {
            throw new Error("Cannot find namespace");
        }

        const personDataType = addressSpace.findDataType("PersonDataType", ns);

        if (!personDataType) {
            throw new Error("Cannot find PersonDataType");
        }

        const namespace = addressSpace.getDefaultNamespace();
        const v = namespace.addVariable({
            browseName: "Var1",
            dataType: personDataType.nodeId,
            propertyOf: addressSpace.rootFolder.objects.server,
        });

        const person = addressSpace.constructExtensionObject(personDataType, {
            name: "Joe Doe"
        });
        person.constructor.name.should.eql("PersonDataType");
        v.setValueFromSource({ dataType: DataType.ExtensionObject, value: person });

        console.log(namespace.toNodeset2XML());
    } catch (err) {
        throw err;
    } finally {
        addressSpace.dispose();
    }
}

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("addExtensionObjectDataType", () => {

    const namespaceUri = "urn:name";

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const ns = addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [
            nodesets.standard
        ];
        await generateAddressSpace(addressSpace, nodesetsXML);

    });
    after(() => {
        addressSpace.dispose();
    });
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

        console.log(dataType.toString());

        dataType.binaryEncoding!.browseName.toString().should.eql("Default Binary");

        // const tmpFile = await fs.promises.mkdtemp(os.tmpdir() + "test.NodeSet2.xml", "utf-8");
        const tmpFile = path.join(os.tmpdir(), "test.NodeSet2.xml");
        console.log("tmpFile =", tmpFile);

        const a = Object.values((ns as any)._nodeid_index);
        a.forEach((b: any) => {
            console.log(b.browseName.toString(), b.nodeId.toString(),
                (b).typeDefinitionObj ? (
                    (b).typeDefinitionObj.browseName.toString() + (b).typeDefinition.toString())
                    : ""); // .nodeId.tostring(), b.browseName.tostring());
        });

        const xml = ns.toNodeset2XML();
        await writeFile(tmpFile, xml, "utf-8");

        const tmpCSVFile = path.join(os.tmpdir(), "test.NodeSet2.csv");
        const csv = (ns as any)._nodeIdManager.getSymbolCSV();
        await writeFile(tmpCSVFile, csv, "utf-8");
        console.log("symbol =\n", csv);

        ///xx fix me await test_back(tmpFile);

    });

});