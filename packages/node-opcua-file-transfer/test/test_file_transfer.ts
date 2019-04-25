// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

import {
    AddressSpace,
    generateAddressSpace, PseudoSession,
    SessionContext,
    UAFileType,
    UAMethod
} from "node-opcua-address-space";
import { nodesets } from "node-opcua-nodesets";

import { ClientFile } from "../source/client/client_file";
import { installFileType } from "../source/server/file_type_helpers";

// tslint:disable:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("FileTransfer", () => {

    let addressSpace: AddressSpace;

    before(async () => {
        const xmlFiles = [
            nodesets.standard
        ];
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, xmlFiles);
        addressSpace.registerNamespace("Own");
    });
    after(() => {
        addressSpace.dispose();
    });

    let opcuaFile: UAFileType;
    before(async () => {
        const namespace = addressSpace.getOwnNamespace();

        const fileType = addressSpace.findObjectType("FileType")!;
        should.exists(fileType);

        opcuaFile = fileType.instantiate({
            browseName: "FileTransferObj",
            organizedBy: addressSpace.rootFolder.objects.server
        }) as UAFileType;

        const filename = path.join(__dirname, "../tempFile.txt");
        await promisify(fs.writeFile)(filename, "content", "utf8");

        installFileType(opcuaFile, filename);

    });
    after(() => {
    });

    it("should expose a File Transfer node and open/close", async () => {

        const session = new PseudoSession(addressSpace);

        const clientFile = new ClientFile(session, opcuaFile.nodeId);

        const handle = await clientFile.open(1);
        handle.should.not.eql(0);
        /// clientFile.handle.should.eql(handle);

        await clientFile.close();
        // clientFile.handle.should.eql(0);

    });

    it("should expose a File Transfer node", async () => {

        const session = new PseudoSession(addressSpace);
        const clientFile = new ClientFile(session, opcuaFile.nodeId);

        await clientFile.open(1);

        const curPos = await clientFile.getPosition();
        curPos.should.eql([0, 0]);

        await clientFile.setPosition([0, 1]);
        const curPos1 = await clientFile.getPosition();
        curPos1.should.eql([0, 1]);

        await clientFile.close();

    });

    it("should read a file ", async () => {

        const session = new PseudoSession(addressSpace);
        const clientFile = new ClientFile(session, opcuaFile.nodeId);

        await clientFile.open(1);

        const buf = await clientFile.read(1000);
        await clientFile.close();

        buf.toString("ascii").should.eql("content");

    });
});
