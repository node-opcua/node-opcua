import * as mocha from "mocha";
import * as should from "should";

import { BinaryStream } from "node-opcua-binary-stream";
import { nodesets } from "node-opcua-nodesets";
import { DataType, Variant } from "node-opcua-variant";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { AddressSpace, ensureDatatypeExtracted, resolveOpaqueOnAddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

describe("Testing PackML custom types", async function (this: any) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        const namespace0 = addressSpace.getDefaultNamespace();

        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.packML]);
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

        debugLog("Reloaded = ", objReloaded.toString());
        return objReloaded;
    }
    it("should create a PackMLAlarmDataType", async () => {
        const nsPackML = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/PackML/");
        nsPackML.should.eql(2, " PackML nodeset must exist");

        const packMLAlarmDataTypeNode = addressSpace.findDataType("PackMLAlarmDataType", nsPackML)!;

        should.exist(packMLAlarmDataTypeNode);
        const packMLAlarm = addressSpace.constructExtensionObject(packMLAlarmDataTypeNode, {
            ackDateTime: new Date(1776, 6, 4),
            ID: 12,
            value: 6,
            dateTime: new Date(1789, 6, 14),
            message: "Hello",
            category: 12,
            trigger: true
        });
        debugLog("packMLAlarm = ", packMLAlarm.toString());
        //xx debugLog(scanResult.schema);

        const v = new Variant({
            dataType: DataType.ExtensionObject,
            value: packMLAlarm
        });
        const reload_v = encode_decode(v);

        reload_v.value.constructor.name.should.eql("OpaqueStructure");

        await resolveOpaqueOnAddressSpace(addressSpace, reload_v);

        reload_v.value.constructor.name.should.eql("PackMLAlarmDataType");

        debugLog(reload_v.toString());
        debugLog(packMLAlarm.toString());

        packMLAlarm.toString().should.eql(reload_v.value.toString());
    });
});
