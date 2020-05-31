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

describe("Testing PackML custom types", async function (this: any) {

    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const namespace0 = addressSpace.getDefaultNamespace();

        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            nodesets.packML,
        ]);
        await ensureDatatypeExtracted(addressSpace);
    });
    after(() => {
        addressSpace.dispose();
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
    it("should create a PackMLAlarmDataType", async () => {

        const nsPackML = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/PackML");
        nsPackML.should.eql(2);

        const packMLAlarmDataTypeNode = addressSpace.findDataType("PackMLAlarmDataType", nsPackML)!;

        should.exist(packMLAlarmDataTypeNode);
        const packMLAlarm = addressSpace.constructExtensionObject(packMLAlarmDataTypeNode, {
            ID: 12,
            value: 6,
            message: "Hello",
            category: 12,
            dateTime: new Date(1789, 6, 14),
            ackDateTime: new Date(1776, 6, 4),
            trigger: true
        });
        console.log("packMLAlarm = ", packMLAlarm.toString());
        //xx console.log(scanResult.schema);

        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: packMLAlarm
        });
        const reload_v = encode_decode(v);

        const extraDataTypeManager = await ensureDatatypeExtracted(addressSpace);
        await resolveDynamicExtensionObject(reload_v, extraDataTypeManager);

        console.log(reload_v.toString());
        console.log(packMLAlarm.toString())
    });

});