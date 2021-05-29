// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
import * as fsOrigin from "fs";
import { fs as fsMemory } from "memfs";

import * as os from "os";
import * as path from "path";
import * as should from "should";
import { promisify } from "util";

import { AddressSpace, PseudoSession, SessionContext, UAFileType, UAMethod } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { UInt64, extraStatusCodeBits, coerceUInt64, coerceNodeId } from "node-opcua-basic-types";
import { nodesets } from "node-opcua-nodesets";

import { ClientFile, FileTypeData, getFileData, OpenFileMode, installFileType, AbstractFs } from "..";
import { MethodIds, NodeId } from "node-opcua-client";

// tslint:disable:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

["with File object methods", "with FileType methods", "with memory file system"].forEach((message) => {
    const useGlobalMethod = !!message.match(/FileType/);
    const withMemFS = message.match(/memory/);

    describe("FileTransfer " + message, () => {
        let addressSpace: AddressSpace;
    
        before(() => {
            if (useGlobalMethod) {
                ClientFile.useGlobalMethod = true;
            }
        });
        after(() => {
            if (useGlobalMethod) {
                ClientFile.useGlobalMethod = false;
            }
        });
        before(async () => {
            const xmlFiles = [nodesets.standard];
            addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, xmlFiles);
            addressSpace.registerNamespace("Own");
        });
        after(() => {
            addressSpace.dispose();
        });

        let opcuaFile: UAFileType;
        let opcuaFile2: UAFileType;
        let fileSystem: AbstractFs;

        before(async () => {
            const namespace = addressSpace.getOwnNamespace();

            const fileType = addressSpace.findObjectType("FileType")!;
            should.exists(fileType);

            // install file 1
            opcuaFile = fileType.instantiate({
                browseName: "FileTransferObj",
                organizedBy: addressSpace.rootFolder.objects.server
            }) as UAFileType;

            fileSystem = withMemFS ? (fsMemory as any as AbstractFs) : fsOrigin;

            const tempFolder = withMemFS ? "/" : await promisify(fsOrigin.mkdtemp)(path.join(os.tmpdir(), "test-"));

            const filename = path.join(tempFolder, "tempFile1.txt");
            await promisify(fileSystem.writeFile)(filename, "content", "utf8");

            installFileType(opcuaFile, { filename, fileSystem: withMemFS ? fileSystem : undefined });

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

            const handle = await clientFile.open(OpenFileMode.Read);
            handle.should.not.eql(0);
            /// clientFile.handle.should.eql(handle);

            await clientFile.close();
            // clientFile.handle.should.eql(0);

            if (ClientFile.useGlobalMethod) {
                (clientFile as any).openMethodNodeId.value.should.eql(MethodIds.FileType_Open);
            }
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

        (withMemFS ? xit : it)("should be possible to write a file - in create mode", async () => {
            // Given a file on server side with some original content
            const fileData = getFileData(opcuaFile2);
            await promisify(fileSystem.writeFile)(fileData.filename, "!!! ORIGINAL CONTENT !!!", "utf-8");
            await fileData.refresh();

            // Given a client that open the file (ReadWrite Mode)
            const session = new PseudoSession(addressSpace);
            const clientFile = new ClientFile(session, opcuaFile2.nodeId);
            const handle = await clientFile.open(OpenFileMode.ReadWrite);
            await clientFile.setPosition([0, 0]);

            // When I write "#### REPLACE ####" at position 0
            await clientFile.write(Buffer.from("#### REPLACE ####"));
            await clientFile.close();

            // Then I should verify that the file now contains "#### REPLACE ####"
            const content = await promisify(fileSystem.readFile)(fileData.filename, "utf-8");
            content.should.eql("#### REPLACE ####");
        });

        (withMemFS ? xit : it)("should be possible to write to a file - in append mode", async () => {
            // Given a file on server side with some original content
            const fileData = getFileData(opcuaFile2);
            await promisify(fileSystem.writeFile)(fileData.filename, "!!! ORIGINAL CONTENT !!!", "utf-8");
            await fileData.refresh();

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
            const content = (await promisify(fileSystem.readFile)(fileData.filename, "utf-8"));
            content.should.eql("!!! ORIGINAL CONTENT !!!" + "#### REPLACE ####");
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

        (withMemFS ? xit : it)("should allow file to grow", async () => {
            const fileData = getFileData(opcuaFile2);
            await promisify(fileSystem.writeFile)(fileData.filename, "!!! ORIGINAL CONTENT !!!", "utf-8");
            await fileData.refresh();

            // Given a client
            const session = new PseudoSession(addressSpace);
            const clientFile = new ClientFile(session, opcuaFile2.nodeId);

            // When I open the file in (ReadWriteAppend Mode)
            const handle = await clientFile.open(OpenFileMode.ReadWriteAppend);

            // read original file size (UInt64!)
            const originalFileSize = await clientFile.size();
            const position0 = await clientFile.getPosition();
            // console.log("position0 = ",position0, "originalFileSize", originalFileSize);
            // then I should verify that position is set at the end of the file
            position0.should.eql(originalFileSize, "expecting position to be at the end of the file after open in Append Mode");

            // then When I write some more data
            const extraData = "#### SOMM MORE DATA ####";
            await clientFile.write(Buffer.from(extraData));
            // and I should verify that the file on the server side contains the expected data
            const content = await promisify(fileSystem.readFile)(fileData.filename, "utf-8");
            content.should.eql("!!! ORIGINAL CONTENT !!!" + extraData);

            // When I re-read file size and check that it has grown accordingly
            const newFileSize = await clientFile.size();

            // I should verify that file size has changed accordingly
            newFileSize[1].should.eql(originalFileSize[1] + extraData.length);

            await clientFile.close();
        });
        (withMemFS ? xit : it)("file size must change on client size if file changes on server side", async () => {
            const fileData = getFileData(opcuaFile2);
            await promisify(fileSystem.writeFile)(fileData.filename, "1", "utf-8");
            await fileData.refresh();

            // Given a client
            const session = new PseudoSession(addressSpace);
            const clientFile = new ClientFile(session, opcuaFile2.nodeId);

            const size1 = await clientFile.size();
            size1.should.eql(coerceUInt64(1));

            await promisify(fileSystem.writeFile)(fileData.filename, "22", "utf-8");
            await fileData.refresh();

            const size2 = await clientFile.size();
            size2.should.eql(coerceUInt64(2));
        });

        function swapHandle(c1: ClientFile, c2: ClientFile) {
            const b = (c2 as any).fileHandle;
            (c2 as any).fileHandle = c1.fileHandle;
            (c1 as any).fileHandle = b;
        }
        (withMemFS ? xit : it)("should not be possible to reuse filehandle generated by one session with an other session", async () => {
            // Given client 1$
            const contextA = new SessionContext({ session: {getSessionId: ()=> coerceNodeId(1)}})
            const sessionA = new PseudoSession(addressSpace, contextA);
            const clientFileA = new ClientFile(sessionA, opcuaFile2.nodeId);

            // Given client 2
            const contextB = new SessionContext({ session: {getSessionId: ()=> coerceNodeId(2)}})
            const sessionB = new PseudoSession(addressSpace, contextB);
            const clientFileB = new ClientFile(sessionB, opcuaFile2.nodeId);

            // When I open the file in Rread
            const fileHandle = await clientFileA.open(OpenFileMode.Read);

            swapHandle(clientFileA, clientFileB);

            // if the handle is used by the wrong session
            let exceptionHasBeenRaised = false;
            try {
                const buf = await clientFileB.read(1000);
            } catch (err) {
                // then a exception should be raised
                exceptionHasBeenRaised = true;
            } finally {
            }
            exceptionHasBeenRaised.should.eql(true);

            swapHandle(clientFileA, clientFileB);
            await clientFileA.close();
        });
    });
});
