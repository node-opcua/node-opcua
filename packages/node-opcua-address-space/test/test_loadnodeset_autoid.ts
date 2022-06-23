import * as mocha from "mocha";
import * as should from "should";

import { BinaryStream } from "node-opcua-binary-stream";
import { ExtensionObject, OpaqueStructure } from "node-opcua-extension-object";
import { nodesets } from "node-opcua-nodesets";
import { DataType, Variant } from "node-opcua-variant";
import { checkDebugFlag, hexDump, make_debugLog } from "node-opcua-debug";
import { AttributeIds } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { CallMethodResult, DataTypeDefinition, StructureDefinition } from "node-opcua-types";
import { getExtraDataTypeManager, promoteOpaqueStructure } from "node-opcua-client-dynamic-extension-object";

import { DataValue } from "node-opcua-data-value";
import { resolveNodeId } from "node-opcua-nodeid";
import {
    AddressSpace,
    adjustNamespaceArray,
    ensureDatatypeExtracted,
    PseudoSession,
    resolveOpaqueOnAddressSpace,
    UAVariable
} from "..";
import { generateAddressSpace } from "../nodeJS";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

describe("Testing AutoID custom types", async function (this: any) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const namespace0 = addressSpace.getDefaultNamespace();

        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.autoId]);
        await ensureDatatypeExtracted(addressSpace);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should construct a ScanSettings", () => {
        enum LocationTypeEnumeration {
            NMEA = 0, // An NMEA string representing a coordinate as defined in 9.1.2.
            LOCAL = 2, // A local coordinate as defined in 9.3.4
            WGS84 = 4, // A lat / lon / alt coordinate as defined in 9.3.16
            NAME = 5 // A name for a location as defined in 9.1.1
        }
        interface ScanSettings extends ExtensionObject {
            duration: number;
            cycles: number;
            dataAvailable: boolean;
            locationType?: LocationTypeEnumeration;
        }
        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        nsAutoId.should.eql(2);

        const scanSettingsDataTypeNode = addressSpace.findDataType("ScanSettings", nsAutoId)!;
        should.exist(scanSettingsDataTypeNode);

        const settings = addressSpace.constructExtensionObject(scanSettingsDataTypeNode, {}) as ScanSettings;
    });

    function encode_decode(obj: Variant): Variant {
        const size = obj.binaryStoreSize();
        const stream = new BinaryStream(Buffer.alloc(size));
        obj.encode(stream);

        stream.rewind();

        // reconstruct a object ( some object may not have a default Binary and should be recreated
        const objReloaded = new Variant();

        objReloaded.decode(stream);

        debugLog("Reloaded = ", objReloaded.toString());
        return objReloaded;
    }

    it("should construct a ScanResult ", async () => {
        interface ScanResult extends ExtensionObject { }

        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        nsAutoId.should.eql(2);

        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;

        should.exist(rfidScanResultDataTypeNode);
        const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {
            // ScanResult
            codeType: "Hello",
            scanData: {
                epc: {
                    pC: 12,
                    uId: Buffer.from("Hello"),
                    xpC_W1: 10,
                    xpC_W2: 12
                }
            },
            timestamp: new Date(2018, 11, 23),
            location: {
                local: {
                    x: 100,
                    y: 200,
                    z: 300,
                    timestamp: new Date(),
                    dilutionOfPrecision: 0.01,
                    usefulPrecicision: 2 // <<!!!! Note the TYPO HERE ! Bug in AutoID.XML !
                }
            }
        }) as ScanResult;

        debugLog("scanResult = ", scanResult.toString());
        //xx debugLog(scanResult.schema);

        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: scanResult
        });
        const reload_v = encode_decode(v);

        await resolveOpaqueOnAddressSpace(addressSpace, reload_v);

        debugLog(reload_v.toString());
        debugLog(scanResult.toString());
    });

    it("should create a opcua variable with a scan result", () => {
        const namespace = addressSpace.getOwnNamespace();

        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        nsAutoId.should.eql(2);

        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;
        should.exist(rfidScanResultDataTypeNode);
        const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {
            codeType: "Code",
            scanData: { string: "Hello" },
            sighting: [{}, {}]
        });

        const scanResultNode = namespace.addVariable({
            browseName: "ScanResult",
            dataType: rfidScanResultDataTypeNode,
            value: { dataType: DataType.ExtensionObject, value: scanResult }
        });
        //        debugLog(scanResultNode.toString());
    });

    it("test RfidScanResult", async () => {
        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");

        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;
        if (!rfidScanResultDataTypeNode) {
            throw new Error("cannot find RfidScanResult");
        }

        const namespace = addressSpace.getOwnNamespace();

        const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {
            // ScanResult
            scanData: {
                epc: {
                    pC: 12,
                    uId: Buffer.from("Hello"),
                    xpC_W1: 10,
                    xpC_W2: 12
                }
            },
            timestamp: new Date(2018, 11, 23),

            location: {
                local: {
                    x: 100,
                    y: 200,
                    z: 300,

                    dilutionOfPrecision: 0.01,
                    timestamp: new Date(),
                    usefulPrecicision: 2 // <<!!!! Note the TYPO HERE ! Bug in AutoID.XML !
                }
            }
        });
        debugLog(scanResult.toString());

        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: scanResult
        });

        const reload_v = encode_decode(v);

        await resolveOpaqueOnAddressSpace(addressSpace, reload_v);

        debugLog(reload_v.toString());

        // re-encode reload_vso that we keep the Opaque structure
        const reload_v2 = encode_decode(reload_v);
        reload_v2.value.should.be.instanceOf(OpaqueStructure);

        // now let's encode the variant that contains the Opaque Strucgture
        const bs2 = new BinaryStream(10000);
        reload_v2.encode(bs2);

        // and verify that it could be decoded well
        const v2 = new Variant();
        bs2.length = 0;
        v2.decode(bs2);
        await resolveOpaqueOnAddressSpace(addressSpace, v2);

        debugLog(v2.toString());
    });

    it("GHU-1 - The dataTypeDefinition of RfidScanResult shall contain base dataTypeDefinition ", () => {
        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");

        const scanResultDataTypeNode = addressSpace.findDataType("ScanResult", nsAutoId);
        {
            const dataValue = scanResultDataTypeNode.readAttribute(null, AttributeIds.DataTypeDefinition);
            dataValue.statusCode.should.eql(StatusCodes.Good);
            const dataTypeDefinition = dataValue.value.value as DataTypeDefinition;
            dataTypeDefinition.should.be.instanceOf(StructureDefinition);

            //Xx console.log(dataTypeDefinition.toString());
            const structureDefinition = dataTypeDefinition as StructureDefinition;
            structureDefinition.fields.length.should.eql(4);
        }
        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;

        {
            const dataValue = rfidScanResultDataTypeNode.readAttribute(null, AttributeIds.DataTypeDefinition);
            dataValue.statusCode.should.eql(StatusCodes.Good);
            const dataTypeDefinition = dataValue.value.value as DataTypeDefinition;
            dataTypeDefinition.should.be.instanceOf(StructureDefinition);

            //Xx console.log(dataTypeDefinition.toString());
            const structureDefinition = dataTypeDefinition as StructureDefinition;
            structureDefinition.fields.length.should.eql(5);
        }
    });
    it("GHU-2 - should promote the OpaqueStructure of an array of variant containing Extension Object", async () => {
        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;
        const extObj1 = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {});
        const extObj2 = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {});

        const callResult = new CallMethodResult({
            statusCode: StatusCodes.Good,
            outputArguments: [
                new Variant({
                    dataType: DataType.ExtensionObject,
                    value: [extObj1, extObj2]
                })
            ]
        });

        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: callResult
        });
        // re-encode reload_vso that we keep the Opaque structure
        const reload_v2 = encode_decode(v);
        reload_v2.value.should.be.instanceOf(CallMethodResult);
        const callbackResult2 = reload_v2.value as CallMethodResult;
        callbackResult2.outputArguments.length.should.eql(1);
        callbackResult2.outputArguments[0].dataType.should.eql(DataType.ExtensionObject);
        callbackResult2.outputArguments[0].value.length.should.eql(2);
        callbackResult2.outputArguments[0].value[0].should.be.instanceOf(OpaqueStructure);
        callbackResult2.outputArguments[0].value[1].should.be.instanceOf(OpaqueStructure);

        const session = new PseudoSession(addressSpace);
        const extraDataTypeManager = await getExtraDataTypeManager(session);
        await promoteOpaqueStructure(
            session,
            callbackResult2.outputArguments.map((a) => ({ value: a }))
        );

        callbackResult2.outputArguments[0].value[0].should.not.be.instanceOf(OpaqueStructure);
        callbackResult2.outputArguments[0].value[1].should.not.be.instanceOf(OpaqueStructure);

        debugLog(reload_v2.toString());
    });
});

function addRfidScanResultVariable(addressSpace: AddressSpace) {
    const namespace = addressSpace.getOwnNamespace();

    const autoIdDemo = namespace.addObject({
        browseName: "AutoIdDemo",
        organizedBy: addressSpace.rootFolder.objects
    });

    const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
    if (nsAutoId < 0) {
        throw new Error("Sorry! I cannot find the AutoId namespace !");
    }
    const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;
    if (!rfidScanResultDataTypeNode) {
        throw new Error("Sorry! I cannot find the RfidScanResult dataType in the AutoId namespace");
    }
    // xx console.log(rfidScanResultDataTypeNode.toString());
    const scanResultDataTypeNode = addressSpace.findDataType("ScanResult", nsAutoId)!;

    // xx console.log(scanResultDataTypeNode.toString());

    const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {
        codeType: "Code",
        scanData: { string: "ScanData" },
        sighting: [
            {
                antenna: 1,
                strength: 25,
                currentPowerLevel: 2,
                timestamp: Date.UTC(2019, 1, 2)
            },
            {
                antenna: 2,
                strength: 19,
                currentPowerLevel: 1,
                timestamp: Date.UTC(2019, 1, 2)
            }
        ]
    });
    const scanResultNode = namespace.addVariable({
        nodeId: "s=ScanResult",
        browseName: "ScanResult",
        dataType: rfidScanResultDataTypeNode,
        value: { dataType: DataType.ExtensionObject, value: scanResult },
        componentOf: autoIdDemo
    });
}
describe("resolving Opaque Structure", function () {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const namespace0 = addressSpace.registerNamespace("MyNamespace");
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.adi, nodesets.autoId]);
        await ensureDatatypeExtracted(addressSpace);

        addRfidScanResultVariable(addressSpace);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("GHV-0  simulate extension object encoding from server side", async () => {
        const v = addressSpace.findNode("ns=1;s=ScanResult")! as UAVariable;

        const dataValue = v.readValue();
        const binaryStream = new BinaryStream(1000);
        dataValue.encode(binaryStream);
        const s1 = binaryStream.buffer.slice(0, binaryStream.length).toString("hex");

        binaryStream.rewind();
        const reloaded = new DataValue();
        reloaded.decode(binaryStream);
        binaryStream.rewind();
        dataValue.encode(binaryStream);
        const s2 = binaryStream.buffer.slice(0, binaryStream.length).toString("hex");

        s2.should.eql(s1);
    });

    it("GHV-2  RfidScanResult DataTypeDefinition should have all fields exposed ", async () => {
        const session = new PseudoSession(addressSpace);
        // i=3007 DataType RfidScanResult
        const browseNameDV = await session.read({ nodeId: "ns=4;i=3007", attributeId: AttributeIds.BrowseName });
        // console.log(browseNameDV.value.toString());
        browseNameDV.value.value.name.should.eql("RfidScanResult");

        const dataValue = await session.read({ nodeId: "ns=4;i=3007", attributeId: AttributeIds.DataTypeDefinition });
        // console.log(dataValue.value.toString());
        const def = dataValue.value.value as StructureDefinition;
        def.fields?.length.should.eql(5);
        def.fields![4].name!.should.eql("Sighting");
        def.fields![4].valueRank.should.eql(1);
    });



    it("GHV-3 should decode this opaque structure", async () => {
        const session = new PseudoSession(addressSpace);
        const dataValue = await session.read({ nodeId: "ns=1;s=ScanResult", attributeId: AttributeIds.Value });
        // console.log(dataValue.value.toString());
        const binaryStream = new BinaryStream(1000);
        dataValue.value.encode(binaryStream);
        const s1 = binaryStream.buffer.slice(0, binaryStream.length).toString("hex");
        console.log(hexDump(binaryStream.buffer.slice(0, binaryStream.length)));

        s1.should.eql(
            "16010493130150000000" +
            "0000000004000000436f646502000000080000005363616e4461746100000000000000000200000001000000190000000040763d8abad4010200000002000000130000000040763d8abad40101000000"
        );
    });

    xit("GHV-4 should decode this opaque structure", async () => {

        const buffer = Buffer.from(
            "0000000004000000436f646502000000080000005363616e44617461000000000000000004000000436f64650200" +
            "0000080000005363616e4461746100000000000000000200000001000000190000000040763d8abad4010200000002" +
            "000000130000000040763d8abad40101000000",
            "hex"
        );
        console.log(
            addressSpace
                .getNamespaceArray()
                .map((n) => n.namespaceUri)
                .join("\n")
        );

        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        nsAutoId.should.eql(4);

        const opaqueStructure = new OpaqueStructure(resolveNodeId("ns=4;i=5011"), buffer);

        const session = new PseudoSession(addressSpace);

        const array = [
            new DataValue({
                value: new Variant({
                    dataType: DataType.ExtensionObject,
                    value: null
                })
            })
        ];
        array[0].value.value = opaqueStructure;

        await promoteOpaqueStructure(session, array);

        console.log(array[0].toString());
    });
});
