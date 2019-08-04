import * as path from "path";
import * as fs from "fs";
import * as should from "should";
import { BinaryStream } from "node-opcua-binary-stream";

import { nodesets } from "node-opcua-nodesets";
import { findBuiltInType } from "node-opcua-factory";
import {
    ExtraDataTypeManager,
    resolveDynamicExtensionObject
} from "node-opcua-client-dynamic-extension-object"


import { AddressSpace, generateAddressSpace, } from "..";
import { ExtensionObject } from "node-opcua-extension-object";
import { Variant, DataType } from "node-opcua-variant";

import { encode_decode_round_trip_test} from "node-opcua-packet-analyzer/dist/test_helpers";

import { ensureDatatypeExtracted } from "../source/loader/load_nodeset2";
import { NodeId } from "node-opcua-nodeid";

describe("Testing AutoID custom types", function (this: any) {

    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const namespace0 = addressSpace.getDefaultNamespace();

        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            nodesets.autoId,
        ]);

        ensureDatatypeExtracted(addressSpace);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should construct a ScanSettings", () => {

        interface ScanSettings extends ExtensionObject {

        }
        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/")
        nsAutoId.should.eql(2);

        const scanSettingsDataTypeNode = addressSpace.findDataType("ScanSettings", nsAutoId);
        should.exist(scanSettingsDataTypeNode);

        const settings = addressSpace.constructExtensionObject(scanSettingsDataTypeNode, {

        } as ScanSettings) as ScanSettings;


    });

    
    function encode_decode<T extends any>(obj: T): T {


        const size = obj.binaryStoreSize();
        const stream = new BinaryStream(Buffer.alloc(size));
        obj.encode(stream);

        stream.rewind();
    
        // reconstruct a object ( some object may not have a default Binary and should be recreated
        const expandedNodeId = obj.encodingDefaultBinary;
        const objReloaded = new obj.constructor();

        objReloaded.decode(stream);

        console.log("Reloaded = ", objReloaded.toString());
        return objReloaded;
    }

    it("should construct a ScanResult ", async () => {

        interface ScanResult extends ExtensionObject {

        }
        
        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/")
        nsAutoId.should.eql(2);

        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId);
        should.exist(rfidScanResultDataTypeNode);
        const scanResult = addressSpace.constructExtensionObject(rfidScanResultDataTypeNode, {
            // ScanResult
            codeType: "Hello",
            scanData: {
                switchField: 3,
                epc: {
                    pC: 12,
                    uId: Buffer.from("Hello"),
                    xpC_W1: 10,
                    xpC_W2: 12
                },
            },
            timestamp: new Date(2018, 11, 23),
            location: {
                switchField: 2,
                local: {
                    x: 100,
                    y: 200,
                    z: 300,
                    timestamp: new Date(),
                    dilutionOfPrecision: 0.01,
                    usefulPrecicision: 2  // <<!!!! Note the TYPO HERE ! Bug in AutoID.XML !
                }
            }
        }) as ScanResult;

        ///xx console.log(scanResult.schema);

        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: scanResult
        });
        const reload_v = encode_decode(v);

        const extraDataTypeManager = await  ensureDatatypeExtracted(addressSpace);
        await resolveDynamicExtensionObject(reload_v, extraDataTypeManager);
        
        console.log(reload_v.toString());

        console.log(scanResult.toString());

    });
});