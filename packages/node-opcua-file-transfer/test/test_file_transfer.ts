// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

import {
    AddressSpace,
    generateAddressSpace, PseudoSession,
    SessionContext,
    UAFileType,
    UAMethod
} from "node-opcua-address-space";
import { UInt64 } from "node-opcua-basic-types";
import { nodesets } from "node-opcua-nodesets";

import {
    ClientFile,
    OpenFileMode
} from "../source/client/client_file";
import {
    FileTypeData,
    getFileData,
    installFileType
} from "../source/server/file_type_helpers";

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
    let opcuaFile2: UAFileType;

    before(async () => {
        const namespace = addressSpace.getOwnNamespace();

        const fileType = addressSpace.findObjectType("FileType")!;
        should.exists(fileType);

        // install file 1
        opcuaFile = fileType.instantiate({
            browseName: "FileTransferObj",
            organizedBy: addressSpace.rootFolder.objects.server
        }) as UAFileType;

        const tempFolder = await promisify(fs.mkdtemp)(path.join(os.tmpdir(), "test-"));

        debugLog("Temporary Folder = ", tempFolder);

        const filename = path.join(tempFolder, "tempFile1.txt");
        await promisify(fs.writeFile)(filename, "content", "utf8");

        installFileType(opcuaFile, { filename });

        // install file 2
        opcuaFile2 = fileType.instantiate({
            browseName: "FileTransferObj2",
            organizedBy: addressSpace.rootFolder.objects.server
        }) as UAFileType;
        const filename2 = path.join(tempFolder, "tempFile2.txt");
        installFileType(opcuaFile2, { filename: filename2 });

    });
    after(() => {
        /* empty */
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

    it("should increase openCount when a file is opened and decrease it when it's closed", async () => {

        const session = new PseudoSession(addressSpace);
        const clientFile = new ClientFile(session, opcuaFile.nodeId);

        const countBefore = await clientFile.openCount();

        await clientFile.open(OpenFileMode.Read);
        const buf = await clientFile.read(1000);

        const countAfter = await clientFile.openCount();
        countAfter.should.eql(countBefore + 1);

        await clientFile.close();
        const countAfter2 = await clientFile.openCount();
        countAfter2.should.eql(countBefore);

    });
    it("should expose the size of the current file", async () => {

        const session = new PseudoSession(addressSpace);
        const clientFile = new ClientFile(session, opcuaFile.nodeId);

        const size: UInt64 = await clientFile.size();
        size.should.eql([0, 7]); // 7 bytes file
    });

    it("should not be possible to write to a file if Write Bit is not set in open mode", async () => {

        // Given a OCUA File
        const session = new PseudoSession(addressSpace);
        const clientFile = new ClientFile(session, opcuaFile.nodeId);

        // Given that the file is opened in ReadMode Only
        await clientFile.open(OpenFileMode.Read);

        // When I try to write to the file
        let hasSucceeded = false;
        let hasReceivedException: any = null;
        try {
            const buf = await clientFile.write(Buffer.from("This is Me !!!"));
            hasSucceeded = true;
        } catch (err) {
            err.message.should.match(/BadInvalidState/);
            hasReceivedException = err;
        }
        await clientFile.close();

        // Then I should verify that the read method has failed
        should.exist(hasReceivedException);
        hasSucceeded.should.eql(false);
        
    });

    it("should be possible to write a file - in create mode", async () => {

        // Given a file on server side with some original content
        const data = getFileData(opcuaFile2);
        fs.writeFileSync(data.filename, "!!! ORIGINAL CONTENT !!!", "utf-8");
        await data.refresh();

        // Given a client that open the file (ReadWrite Mode)
        const session = new PseudoSession(addressSpace);
        const clientFile = new ClientFile(session, opcuaFile2.nodeId);
        const handle = await clientFile.open(OpenFileMode.ReadWrite);
        await clientFile.setPosition([0, 0]);

        // When I write "#### REPLACE ####" at position 0
        await clientFile.write(Buffer.from("#### REPLACE ####"));
        await clientFile.close();

        // Then I should verify that the file now contains "#### REPLACE ####"
        fs.readFileSync(data.filename, "utf-8").should.eql("#### REPLACE ####");

    });

    it("should be possible to write to a file - in append mode", async () => {

        // Given a file on server side with some original content
        const data = getFileData(opcuaFile2);
        fs.writeFileSync(data.filename, "!!! ORIGINAL CONTENT !!!", "utf-8");
        await data.refresh();

        // Given a client
        const session = new PseudoSession(addressSpace);
        const clientFile = new ClientFile(session, opcuaFile2.nodeId);

        // When I open the file in (ReadWriteAppend Mode)
        const handle = await clientFile.open(OpenFileMode.ReadWriteAppend);

        // then I should verify that position is set at the end of the file
        const fileSize = await clientFile.size();
        const position0 = await clientFile.getPosition();
        position0.should.eql(fileSize, "expecting position to be at the end of the file after open in Append Mode");

        // and When I write some more data
        await clientFile.write(Buffer.from("#### REPLACE ####"));

        // then I should verify that the position has evolved accordingly
        const position1 = await clientFile.getPosition();

        position1.should.eql([0, 41], "expecting position to be at the end of the file");

        await clientFile.close();

        // and I should verify that the file on the server side contains the expected data
        fs.readFileSync(data.filename, "utf-8").should.eql("!!! ORIGINAL CONTENT !!!" + "#### REPLACE ####");

    });

    it("should not allow read method if Read bit is not set in open mode", async () => {

        // Given a OCUA File
        const session = new PseudoSession(addressSpace);
        const clientFile = new ClientFile(session, opcuaFile.nodeId);

        // When I open the file without Read bit set
        await clientFile.open(OpenFileMode.Write); // open in write mode

        // When I read the file
        let hasSucceeded = false;
        let hasReceivedException: any = null;
        try {
            const numberOfByteToRead = 1;
            const buf = await clientFile.read(numberOfByteToRead);
            hasSucceeded = true;
        } catch (err) {
            err.message.should.match(/BadInvalidState/);
            hasReceivedException = err;
        }
        await clientFile.close();

        // Then I should verify that the read method has failed
        should.exist(hasReceivedException, "It should have received an exception");
        hasSucceeded.should.eql(false);

    });

});
