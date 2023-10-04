import "should";
import path from "path";
import fs from "fs";
import { nodesets } from "node-opcua-nodesets";
import { resolveNodeId } from "node-opcua-nodeid";
import { AttributeIds, DataType, StatusCodes } from "node-opcua-basic-types";
import { Variant } from "node-opcua-variant";
import { AddressSpace } from "..";
import { generateAddressSpace } from "../distNodeJS";
import { UAVariableImpl } from "../dist/src/ua_variable_impl";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Advanced nodeset to XML", () => {

    const nodesetFilename = path.join(__dirname, "../test_helpers/test_fixtures/nodeset_with_extensionObjects_datatype.xml");
    const tmpFolder = path.join(__dirname, "../tmp");
    before(() => {
        if (!fs.existsSync(tmpFolder)) {
            fs.mkdirSync(tmpFolder);
        }
    });

    it("namespace should export a UAVariable with custom Extension Object to NodeSet2.XML correctly", async () => {
        const exportedNodeSet2Filename = path.join(tmpFolder, "someNodeSet2.xml");
        {
            const addressSpace = AddressSpace.create();

           addressSpace.registerNamespace("https://mynamespace");
            await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.adi, nodesetFilename]);

            const ns = addressSpace.getNamespaceIndex("http://sterfive.com/UA/test/");
            const myCustomType = addressSpace.findDataType("BaseType2", ns)!;

            const extensionObject = addressSpace.constructExtensionObject(myCustomType, {
                field1: 3.14,
                field2: 42
            });
             const ownNamespace = addressSpace.getOwnNamespace();
            const uaVariable = ownNamespace.addVariable({
                browseName: "MyVariable",
                dataType: resolveNodeId(DataType.ExtensionObject),
                nodeId: "s=MyVariable"
            });
            uaVariable.setValueFromSource({ dataType: DataType.ExtensionObject, value: extensionObject });
            try {
                const nodeset2XMLString = ownNamespace.toNodeset2XML();
                await fs.promises.writeFile(exportedNodeSet2Filename, nodeset2XMLString);
            } finally {
                addressSpace.dispose();
            }
            //
            console.log((uaVariable as UAVariableImpl).$dataValue.toString());
        }
        {
            const addressSpace2 = AddressSpace.create();
            await generateAddressSpace(addressSpace2, [nodesets.standard, nodesetFilename, exportedNodeSet2Filename]);
            const ns1 = addressSpace2.getNamespaceIndex("https://mynamespace");
            const uaMyVariable = addressSpace2.findNode(`ns=${ns1};s=MyVariable`)!;

            const dataValue = uaMyVariable.readAttribute(null, AttributeIds.Value);
            console.log(dataValue.toString());
            dataValue.statusCode.should.eql(StatusCodes.Good);
            const v: Variant = dataValue.value;
            v.dataType.should.eql(DataType.ExtensionObject);
            v.value.schema.name.should.eql("BaseType2");
            v.value.field1.should.eql(3.14);
            v.value.field2.should.eql(42);
            addressSpace2.dispose();
        }
    });

    it("exporting own namespace with Extension object from a differnt namespace", async () => {
       
        const exportedNodeSet2Filename = path.join(tmpFolder, "someOtherNodeSet2.xml");
        {
            const addressSpace = AddressSpace.create();
            // register own namespace first
            addressSpace.registerNamespace("https://mynamespace");
            await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.autoId]);
            
            const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
            const rfidScanResultDataType = addressSpace.findDataType("RfidScanResult", nsAutoId)!;

            const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataType, {
            });


            const ownNamespace = addressSpace.getOwnNamespace();
            const uaVariable = ownNamespace.addVariable({
                browseName: "MyVariable",
                dataType: resolveNodeId(DataType.ExtensionObject),
                nodeId: "s=MyVariable"
            });

            uaVariable.setValueFromSource({ dataType: DataType.ExtensionObject, value: scanResult });
            try {
                const nodeset2XMLString = ownNamespace.toNodeset2XML();
                await fs.promises.writeFile(exportedNodeSet2Filename, nodeset2XMLString);
            } finally {
                addressSpace.dispose();
            }
            //
            console.log((uaVariable as UAVariableImpl).$dataValue.toString());
        }
        {
            const addressSpace2 = AddressSpace.create();
            await generateAddressSpace(addressSpace2, [nodesets.standard, nodesets.di, nodesets.autoId, exportedNodeSet2Filename]);
            const ns1 = addressSpace2.getNamespaceIndex("https://mynamespace");
            const uaMyVariable = addressSpace2.findNode(`ns=${ns1};s=MyVariable`)!;

            const dataValue = uaMyVariable.readAttribute(null, AttributeIds.Value);
            console.log(dataValue.toString());
            dataValue.statusCode.should.eql(StatusCodes.Good);
            const v: Variant = dataValue.value;
            v.dataType.should.eql(DataType.ExtensionObject);
            v.value.schema.name.should.eql("RfidScanResult");
            addressSpace2.dispose();
        }
    });
});
