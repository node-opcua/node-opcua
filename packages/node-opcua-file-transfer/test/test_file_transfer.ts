// make sure extra error checking is made on object constructions
// tslint:disable-next-line:no-var-requires
import * as fsOrigin from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";
import { randomBytes } from "crypto";
import sinon from "sinon";

import { fs as fsMemory } from "memfs";

import should from "should";

import { AddressSpace, PseudoSession, SessionContext, UAFile } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { UInt64, coerceUInt64, coerceNodeId } from "node-opcua-basic-types";
import { CallMethodRequestOptions, MethodIds } from "node-opcua-client";
import { NodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { MockContinuationPointManager } from "node-opcua-address-space/testHelpers";

import { ClientFile, getFileData, OpenFileMode, installFileType, AbstractFs, readFile, IClientFilePriv, writeOPCUAFile, readOPCUAFile } from "..";

// tslint:disable:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
["with File object methods", "with FileType methods", "with memory file system"].forEach((message) => {
    const useGlobalMethod = !!message.match(/FileType/);
    const withMemFS = message.match(/memory/);
    const m1 = useGlobalMethod ? "Global" : "Local";
    const m2 = withMemFS ? "MemFS" : "FileFS";
    const m = m1 + "-" + m2 + "-";
    describe("FileTransfer " + message, function (this: Mocha.Suite) {

        this.timeout(6 * 60 * 1000);

        let addressSpace: AddressSpace;

        before(async () => {
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

        let opcuaFile: UAFile;
        let opcuaFile2: UAFile;
        let fileSystem: AbstractFs;
        let tempFolder: string;
        let filename2: string;

        before(async () => {
            const namespace = addressSpace.getOwnNamespace();

            const fileType = addressSpace.findObjectType("FileType")!;
            should.exists(fileType);

            // install file 1
            opcuaFile = fileType.instantiate({
                browseName: "FileTransferObj",
                organizedBy: addressSpace.rootFolder.objects.server
            }) as UAFile;

            tempFolder = withMemFS ? "/" : await promisify(fsOrigin.mkdtemp)(path.join(os.tmpdir(), "test-"));

            fileSystem = withMemFS ? (fsMemory as any as AbstractFs) : fsOrigin;


            const filename = path.join(tempFolder, "tempFile1.txt");
            console.log("filename=", filename);
            await promisify(fileSystem.writeFile)(filename, "content", {});

            installFileType(opcuaFile, { filename, fileSystem: withMemFS ? fileSystem : undefined });

            // install file 2
            opcuaFile2 = fileType.instantiate({
                browseName: "FileTransferObj2",
                organizedBy: addressSpace.rootFolder.objects.server
            }) as UAFile;

            filename2 = path.join(tempFolder, "tempFile2.txt");
            installFileType(opcuaFile2, { filename: filename2, fileSystem: withMemFS ? fileSystem : undefined });
        });
        async function readFile2(): Promise<Buffer> {
            const ret = await promisify(fileSystem.readFile)(filename2, "binary") as unknown as Buffer;
            return ret;
        }
        async function resetFile2() {
            await promisify(fileSystem.writeFile)(filename2, "HelloWorld", "ascii");

        }
        after(() => {
            /* empty */
        });
        beforeEach(async () => {
            if (filename2)
                await resetFile2();
        });

        it(m + "should expose a File Transfer node and open/close", async () => {
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

        it(m + "should expose a File Transfer node", async () => {
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

        it(m + "should read a file ", async () => {
            const session = new PseudoSession(addressSpace);
            const clientFile = new ClientFile(session, opcuaFile.nodeId);

            await clientFile.open(1);

            const buf = await clientFile.read(1000);
            await clientFile.close();

            buf.toString("utf-8").should.eql("content");
        });

        it(m + "should increase openCount when a file is opened and decrease it when it's closed", async () => {
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
        it(m + "should expose the size of the current file", async () => {
            const session = new PseudoSession(addressSpace);
            const clientFile = new ClientFile(session, opcuaFile.nodeId);

            const size: UInt64 = await clientFile.size();
            size.should.eql([0, 7]); // 7 bytes file
        });

        it(m + "should not be possible to write to a file if Write Bit is not set in open mode", async () => {
            // Given a OCUA File
            const session = new PseudoSession(addressSpace);
            const clientFile = new ClientFile(session, opcuaFile.nodeId);

            // Given that the file is opened in ReadMode Only
            await clientFile.open(OpenFileMode.Read);

            // When I try to write to the file
            let hasSucceeded = false;
            let hasReceivedException: Error | undefined;
            try {
                const buf = await clientFile.write(Buffer.from("This is Me !!!"));
                hasSucceeded = true;
            } catch (err) {
                hasReceivedException = err as Error;
            }
            await clientFile.close();

            // Then I should verify that the read method has failed
            should.exist(hasReceivedException);
            hasReceivedException!.message.should.match(/BadInvalidState/);
            hasSucceeded.should.eql(false);
        });

        it(m + "should be possible to write a file - in create mode", async () => {
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

        it(m + "should be possible to write to a file - in append mode", async () => {
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
            const content = await promisify(fileSystem.readFile)(fileData.filename, "utf-8");
            content.should.eql("!!! ORIGINAL CONTENT !!!" + "#### REPLACE ####");
        });

        it(m + "should not allow read method if Read bit is not set in open mode", async () => {
            // Given a OCUA File
            const session = new PseudoSession(addressSpace);
            const clientFile = new ClientFile(session, opcuaFile.nodeId);

            // When I open the file without Read bit set
            await clientFile.open(OpenFileMode.Write); // open in write mode

            // When I read the file
            let hasSucceeded = false;
            let hasReceivedException: Error | undefined;
            try {
                const numberOfByteToRead = 1;
                const buf = await clientFile.read(numberOfByteToRead);
                hasSucceeded = true;
            } catch (err) {
                hasReceivedException = err as Error;
            }
            await clientFile.close();

            // Then I should verify that the read method has failed
            should.exist(hasReceivedException, "It should have received an exception");
            hasReceivedException!.message.should.match(/BadInvalidState/);
            hasSucceeded.should.eql(false);
        });

        it(m + "should allow file to grow", async () => {
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

        it(m + "file size must change on client size if file changes on server side", async () => {
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


        it(m + "readFile", async () => {
            const fileData = getFileData(opcuaFile2);
            await promisify(fileSystem.writeFile)(fileData.filename, "1234567890", "utf-8");
            await fileData.refresh();

            const session = new PseudoSession(addressSpace);
            const clientFile = (new ClientFile(session, opcuaFile2.nodeId)) as unknown as IClientFilePriv;
            await (clientFile as any).ensureInitialized();


            const callSpy = sinon.spy(session, "call");
            const buf = await readFile(clientFile);
            callSpy.callCount.should.equal(3);

            const openMethod = clientFile.openMethodNodeId!;
            const readMethod = clientFile.readNodeId!
            const closeMethod = clientFile.closeMethodNodeId!;
            const getMethod = (n: number) => callSpy.getCall(n).args[0] as CallMethodRequestOptions;

            getMethod(0).methodId?.should.eql(openMethod);
            getMethod(1).methodId?.should.eql(readMethod);
            getMethod(2).methodId?.should.eql(closeMethod);

            buf.toString("utf-8").should.eql("1234567890");
        });

        it(m + "readFile with large file", async () => {


            const randomData = randomBytes(3 * 1024).toString("hex");

            randomData.length.should.equal(6 * 1024);

            const fileData = getFileData(opcuaFile2);

            const oldMaxSize = fileData.maxChunkSizeBytes;

            fileData.maxChunkSizeBytes = 1024;

            await promisify(fileSystem.writeFile)(fileData.filename, randomData, "utf-8");
            await fileData.refresh();


            const session = new PseudoSession(addressSpace);
            const clientFile = new ClientFile(session, opcuaFile2.nodeId) as unknown as IClientFilePriv;
            await clientFile.ensureInitialized();


            const callSpy = sinon.spy(session, "call");

            console.log("--start reading");
            const buf = await readFile(clientFile);


            const openMethod = clientFile.openMethodNodeId!;
            const readMethod = clientFile.readNodeId!
            const closeMethod = clientFile.closeMethodNodeId!;
            const getMethod = (n: number) => callSpy.getCall(n).args[0] as CallMethodRequestOptions;

            getMethod(0).methodId?.should.eql(openMethod);
            getMethod(1).methodId?.should.eql(readMethod);
            getMethod(2).methodId?.should.eql(readMethod);
            getMethod(3).methodId?.should.eql(readMethod);
            getMethod(4).methodId?.should.eql(readMethod);
            getMethod(5).methodId?.should.eql(readMethod);
            getMethod(6).methodId?.should.eql(readMethod);
            getMethod(7).methodId?.should.eql(closeMethod);

            callSpy.callCount.should.equal(8);

            buf.toString("utf-8").should.eql(randomData);

            fileData.maxChunkSizeBytes = oldMaxSize;

        });

        it(m + "writeOPCUAFile with large file", async () => {

            console.log("writeOPCUAFile");
            const session = new PseudoSession(addressSpace);
            const clientFile = new ClientFile(session, opcuaFile2.nodeId) as unknown as IClientFilePriv;
            await clientFile.ensureInitialized();

            const filepath = path.join(__dirname, "foo.txt");

            const callSpy = sinon.spy(session, "call");
            await writeOPCUAFile(clientFile, filepath, { chunkSize: 102 });

            const openMethod = clientFile.openMethodNodeId!;
            const writeMethod = clientFile.writeNodeId!
            const setPosition = clientFile.setPositionNodeId!;
            const closeMethod = clientFile.closeMethodNodeId!;
            const getMethod = (n: number) => callSpy.getCall(n).args[0] as CallMethodRequestOptions;
            getMethod(0).methodId?.should.eql(openMethod);
            getMethod(1).methodId?.should.eql(setPosition);
            getMethod(2).methodId?.should.eql(writeMethod);
            getMethod(3).methodId?.should.eql(writeMethod);
            getMethod(4).methodId?.should.eql(writeMethod);
            getMethod(5).methodId?.should.eql(writeMethod);
            getMethod(6).methodId?.should.eql(closeMethod);

            const content = await fsOrigin.promises.readFile(filepath);

            const content2 = await readFile2();
            content.toString("ascii").should.eql(content2.toString("ascii"));

            const buffer = await readOPCUAFile(clientFile);

            content.toString("ascii").should.eql(buffer.toString("ascii"));

        });


        function swapHandle(c1: ClientFile, c2: ClientFile) {
            const b = (c2 as any).fileHandle;
            (c2 as any).fileHandle = c1.fileHandle;
            (c1 as any).fileHandle = b;
        }

        it(m + "should not be possible to reuse filehandle generated by one session with an other session", async () => {
            // Given client 1$
            const contextA = new SessionContext({
                session: {
                    getSessionId: () => coerceNodeId(1),
                    continuationPointManager: new MockContinuationPointManager()
                }
            });
            const sessionA = new PseudoSession(addressSpace, contextA);
            const clientFileA = new ClientFile(sessionA, opcuaFile2.nodeId);

            // Given client 2
            const contextB = new SessionContext({
                session: {
                    getSessionId: () => coerceNodeId(2),
                    continuationPointManager: new MockContinuationPointManager()
                }
            });
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
                /** */
            }
            exceptionHasBeenRaised.should.eql(true);

            swapHandle(clientFileA, clientFileB);
            await clientFileA.close();
        });
    });
});
