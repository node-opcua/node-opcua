import * as mocha from "mocha";
import * as should from "should";

import { BinaryStream } from "node-opcua-binary-stream";
import { resolveDynamicExtensionObject } from "node-opcua-client-dynamic-extension-object";
import { ExtensionObject, OpaqueStructure } from "node-opcua-extension-object";
import { nodesets } from "node-opcua-nodesets";
import { DataType, Variant } from "node-opcua-variant";

import { AddressSpace, ensureDatatypeExtracted } from "..";
import { generateAddressSpace } from "../nodeJS";

import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { AttributeIds } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { DataTypeDefinition, StructureDefinition } from "node-opcua-types";

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

        const extraDataTypeManager = await ensureDatatypeExtracted(addressSpace);
        await resolveDynamicExtensionObject(reload_v, extraDataTypeManager);

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

        const extraDataTypeManager = await ensureDatatypeExtracted(addressSpace);
        await resolveDynamicExtensionObject(reload_v, extraDataTypeManager);

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
        await resolveDynamicExtensionObject(v2, extraDataTypeManager);
        debugLog(v2.toString());
    });

    it("KX The dataTypeDefinition of RfidScanResult shall contain base dataTypeDefinition ", () => {

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

});
