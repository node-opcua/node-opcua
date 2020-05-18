import * as mocha from "mocha";
import * as should from "should";

import { BinaryStream } from "node-opcua-binary-stream";
import {
    resolveDynamicExtensionObject
} from "node-opcua-client-dynamic-extension-object";
import { ExtensionObject } from "node-opcua-extension-object";
import { nodesets } from "node-opcua-nodesets";
import { DataType, Variant } from "node-opcua-variant";

import {
    AddressSpace,
    ensureDatatypeExtracted,
    generateAddressSpace,
} from "..";

describe("Testing AutoID custom types", async function (this: any) {

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
        await ensureDatatypeExtracted(addressSpace);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should construct a ScanSettings", () => {

        interface ScanSettings extends ExtensionObject {

        }
        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        nsAutoId.should.eql(2);

        const scanSettingsDataTypeNode = addressSpace.findDataType("ScanSettings", nsAutoId)!;
        should.exist(scanSettingsDataTypeNode);

        const settings = addressSpace.constructExtensionObject(scanSettingsDataTypeNode, {
        }) as ScanSettings;

    });

    function encode_decode(obj: Variant): Variant {

        const size = obj.binaryStoreSize();
        const stream = new BinaryStream(Buffer.alloc(size));
        obj.encode(stream);

        stream.rewind();

        // reconstruct a object ( some object may not have a default Binary and should be recreated
        const objReloaded = new Variant();

        objReloaded.decode(stream);

        console.log("Reloaded = ", objReloaded.toString());
        return objReloaded;
    }

    it("should construct a ScanResult ", async () => {

        interface ScanResult extends ExtensionObject {

        }

        const nsAutoId = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/AutoID/");
        nsAutoId.should.eql(2);

        const rfidScanResultDataTypeNode = addressSpace.findDataType("RfidScanResult", nsAutoId)!;
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

        console.log("scanResult = ", scanResult.toString());
        console.log(scanResult.schema);

        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: scanResult
        });
        const reload_v = encode_decode(v);

        const extraDataTypeManager = await ensureDatatypeExtracted(addressSpace);
        await resolveDynamicExtensionObject(reload_v, extraDataTypeManager);

        console.log(reload_v.toString());

        console.log(scanResult.toString());

    });
});
