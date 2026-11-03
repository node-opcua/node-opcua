import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
    AddressSpace,
    type IServerBase,
    type ISessionBase,
    makeRoles,
    PermissionType,
    PseudoSession,
    SessionContext,
    type SessionShutdownTask,
    type UAFile,
    WellKnownRoles
} from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import { MockContinuationPointManager } from "node-opcua-address-space/testHelpers.js";
import { coerceNodeId, type UInt64 } from "node-opcua-basic-types";
import { AttributeIds } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { UserNameIdentityToken } from "node-opcua-types";
import { DataType, VariantArrayType } from "node-opcua-variant";
import should from "should";
import {
    ClientFile,
    defaultMaxOpenFilesPerServer,
    defaultMaxOpenFilesPerSession,
    type FileOptions,
    getFileData,
    installFileType,
    OpenFileMode
} from "../dist/index.js";

describe("FileType: write access, size limit and file handle limit", () => {
    let addressSpace: AddressSpace;
    let tempFolder: string;
    let nextId = 1;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        addressSpace.registerNamespace("Own");
        tempFolder = fs.mkdtempSync(path.join(os.tmpdir(), "file-type-"));
    });
    after(() => {
        addressSpace.dispose();
        fs.rmSync(tempFolder, { recursive: true, force: true });
    });

    const SEED = "SEED-CONTENT";
    function makeFile(options?: Partial<FileOptions>): { file: UAFile; filename: string } {
        const id = nextId++;
        const filename = path.join(tempFolder, `file${id}.txt`);
        fs.writeFileSync(filename, SEED);
        const file = addressSpace.findObjectType("FileType")!.instantiate({
            browseName: `File${id}`,
            organizedBy: addressSpace.rootFolder.objects.server
        }) as UAFile;
        installFileType(file, { filename, ...options });
        return { file, filename };
    }

    interface SessionFixture {
        session: PseudoSession;
        runShutdownTasks(): Promise<void>;
        taskCount(): number;
    }
    function makeSession(userName = "operator"): SessionFixture {
        const tasks: SessionShutdownTask[] = [];
        const sessionId = coerceNodeId(nextId++);
        const server: IServerBase = {
            userManager: {
                getUserRoles: () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator])
            }
        };
        const sessionBase: ISessionBase = {
            userIdentityToken: new UserNameIdentityToken({ userName }),
            getSessionId: () => sessionId,
            continuationPointManager: new MockContinuationPointManager(),
            registerSessionShutdownTask: (task) => {
                tasks.push(task);
            }
        };
        const context = new SessionContext({ server, session: sessionBase });
        return {
            session: new PseudoSession(addressSpace, context),
            taskCount: () => tasks.length,
            runShutdownTasks: async () => {
                await Promise.all(tasks.map((task) => task()));
            }
        };
    }

    async function open(session: PseudoSession, file: UAFile, mode: OpenFileMode) {
        const result = await session.call({
            objectId: file.nodeId,
            methodId: file.open.nodeId,
            inputArguments: [{ dataType: DataType.Byte, value: mode }]
        });
        return result.statusCode;
    }
    async function call(session: PseudoSession, file: UAFile, methodId: UAFile["write"], handle: number, value: Buffer | UInt64) {
        const inputArguments = [
            { dataType: DataType.UInt32, value: handle },
            Buffer.isBuffer(value)
                ? { dataType: DataType.ByteString, value }
                : { dataType: DataType.UInt64, arrayType: VariantArrayType.Scalar, value }
        ];
        const result = await session.call({ objectId: file.nodeId, methodId: methodId.nodeId, inputArguments });
        return result.statusCode;
    }
    async function readBoolean(session: PseudoSession, node: UAFile["writable"]) {
        const dataValue = await session.read({ nodeId: node.nodeId, attributeId: AttributeIds.Value });
        return dataValue.value.value as boolean;
    }
    const denyCallOnWrite = (file: UAFile) =>
        file.write.setRolePermissions([
            { roleId: WellKnownRoles.SecurityAdmin, permissions: PermissionType.Browse | PermissionType.Call },
            { roleId: WellKnownRoles.Operator, permissions: PermissionType.Browse }
        ]);

    describe("write access", () => {
        it("a file is writable by default, and Writable and UserWritable expose it", async () => {
            const { file, filename } = makeFile();
            const { session } = makeSession();
            should(await readBoolean(session, file.writable)).eql(true);
            should(await readBoolean(session, file.userWritable)).eql(true);

            const clientFile = new ClientFile(session, file.nodeId);
            await clientFile.open(OpenFileMode.WriteEraseExisting);
            await clientFile.write(Buffer.from("NEW"));
            await clientFile.close();
            should(fs.readFileSync(filename, "utf8")).eql("NEW");
        });

        for (const mode of [OpenFileMode.Write, OpenFileMode.WriteEraseExisting, OpenFileMode.WriteAppend]) {
            it(`Open(${OpenFileMode[mode]}) on a file with writable:false returns BadNotWritable and keeps the content`, async () => {
                const { file, filename } = makeFile({ writable: false });
                const { session } = makeSession();

                should(await open(session, file, mode)).eql(StatusCodes.BadNotWritable);
                should(fs.readFileSync(filename, "utf8")).eql(SEED);
                should(getFileData(file).openCount).eql(0);
            });
        }

        it("a file with writable:false can be read, and exposes false", async () => {
            const { file } = makeFile({ writable: false });
            const { session } = makeSession();
            should(await readBoolean(session, file.writable)).eql(false);
            should(await readBoolean(session, file.userWritable)).eql(false);

            const clientFile = new ClientFile(session, file.nodeId);
            await clientFile.open(OpenFileMode.Read);
            const data = await clientFile.read(100);
            await clientFile.close();
            should(data.toString()).eql(SEED);
        });

        it("Open for writing returns BadUserAccessDenied if the user cannot call the Write Method", async () => {
            const { file, filename } = makeFile();
            denyCallOnWrite(file);
            const { session, runShutdownTasks } = makeSession();

            should(await readBoolean(session, file.writable)).eql(true);
            should(await readBoolean(session, file.userWritable)).eql(false);
            should(await open(session, file, OpenFileMode.WriteEraseExisting)).eql(StatusCodes.BadUserAccessDenied);
            should(fs.readFileSync(filename, "utf8")).eql(SEED);

            // Read access does not change
            should(await open(session, file, OpenFileMode.Read)).eql(StatusCodes.Good);
            await runShutdownTasks();
        });
    });

    describe("maxSize", () => {
        it("accepts a Write up to maxSize, and refuses a Write past maxSize", async () => {
            const { file, filename } = makeFile({ maxSize: 100 });
            const { session } = makeSession();
            const clientFile = new ClientFile(session, file.nodeId);
            await clientFile.open(OpenFileMode.WriteEraseExisting);
            await clientFile.write(Buffer.alloc(100, 0x41));

            const handle = clientFile.fileHandle;
            should(await call(session, file, file.write, handle, Buffer.alloc(1))).eql(StatusCodes.BadOutOfRange);
            await clientFile.close();
            should(fs.statSync(filename).size).eql(100);
        });

        it("in append mode, SetPosition does not avoid the limit", async () => {
            const { file, filename } = makeFile({ maxSize: SEED.length + 10 });
            const { session } = makeSession();
            const clientFile = new ClientFile(session, file.nodeId);
            await clientFile.open(OpenFileMode.ReadWriteAppend);
            const handle = clientFile.fileHandle;

            for (let i = 0; i < 2; i++) {
                should(await call(session, file, file.setPosition, handle, [0, 0])).eql(StatusCodes.Good);
                should(await call(session, file, file.write, handle, Buffer.alloc(5))).eql(StatusCodes.Good);
            }
            should(await call(session, file, file.setPosition, handle, [0, 0])).eql(StatusCodes.Good);
            should(await call(session, file, file.write, handle, Buffer.alloc(1))).eql(StatusCodes.BadOutOfRange);
            await clientFile.close();
            should(fs.statSync(filename).size).eql(SEED.length + 10);
        });

        it("maxSize:0 means no limit", async () => {
            const { file, filename } = makeFile({ maxSize: 0 });
            const { session } = makeSession();
            const clientFile = new ClientFile(session, file.nodeId);
            await clientFile.open(OpenFileMode.WriteEraseExisting);
            await clientFile.write(Buffer.alloc(1000));
            await clientFile.close();
            should(fs.statSync(filename).size).eql(1000);
        });

        it("a Write with no data returns Good and has no effect", async () => {
            const { file, filename } = makeFile({ maxSize: 1 });
            const { session } = makeSession();
            const clientFile = new ClientFile(session, file.nodeId);
            await clientFile.open(OpenFileMode.ReadWrite);
            should(await call(session, file, file.write, clientFile.fileHandle, Buffer.alloc(0))).eql(StatusCodes.Good);
            await clientFile.close();
            should(fs.readFileSync(filename, "utf8")).eql(SEED);
        });
    });

    describe("SetPosition", () => {
        for (const position of [
            [0, 64 * 1024],
            [1, 0]
        ] as UInt64[]) {
            it(`a position higher than the file size [${position}] sets the position to the end of the file`, async () => {
                const { file, filename } = makeFile();
                const { session } = makeSession();
                const clientFile = new ClientFile(session, file.nodeId);
                await clientFile.open(OpenFileMode.ReadWrite);

                should(await call(session, file, file.setPosition, clientFile.fileHandle, position)).eql(StatusCodes.Good);
                should(await clientFile.getPosition()).eql([0, SEED.length]);

                await clientFile.write(Buffer.from("!"));
                await clientFile.close();
                should(fs.readFileSync(filename, "utf8")).eql(`${SEED}!`);
            });
        }
    });

    describe("file handle limit", () => {
        it("has a default of 10 handles per session", () => {
            should(defaultMaxOpenFilesPerSession).eql(10);
        });

        it("Open returns BadResourceUnavailable at the limit, and succeeds again after a Close", async () => {
            const { file } = makeFile();
            const { session, runShutdownTasks } = makeSession();
            const clientFiles: ClientFile[] = [];
            for (let i = 0; i < defaultMaxOpenFilesPerSession; i++) {
                const clientFile = new ClientFile(session, file.nodeId);
                await clientFile.open(OpenFileMode.Read);
                clientFiles.push(clientFile);
            }
            should(await open(session, file, OpenFileMode.Read)).eql(StatusCodes.BadResourceUnavailable);
            should(getFileData(file).openCount).eql(defaultMaxOpenFilesPerSession);

            await clientFiles[0].close();
            should(await open(session, file, OpenFileMode.Read)).eql(StatusCodes.Good);
            await runShutdownTasks();
        });

        it("the limit applies to one session, and to all the files of this session", async () => {
            const { file: file1 } = makeFile({ maxOpenFilesPerSession: 2 });
            const { file: file2 } = makeFile({ maxOpenFilesPerSession: 2 });
            const a = makeSession();
            const b = makeSession();
            should(await open(a.session, file1, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(await open(a.session, file2, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(await open(a.session, file1, OpenFileMode.Read)).eql(StatusCodes.BadResourceUnavailable);
            should(await open(a.session, file2, OpenFileMode.Read)).eql(StatusCodes.BadResourceUnavailable);
            should(await open(b.session, file1, OpenFileMode.Read)).eql(StatusCodes.Good);
            await a.runShutdownTasks();
            await b.runShutdownTasks();
        });

        it("a refused Open with EraseExisting keeps the content", async () => {
            const { file, filename } = makeFile({ maxOpenFilesPerSession: 1 });
            const { session, runShutdownTasks } = makeSession();
            should(await open(session, file, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(await open(session, file, OpenFileMode.WriteEraseExisting)).eql(StatusCodes.BadResourceUnavailable);
            should(fs.readFileSync(filename, "utf8")).eql(SEED);
            await runShutdownTasks();
        });

        it("an Open that fails does not use a handle", async () => {
            const { file, filename } = makeFile({ maxOpenFilesPerSession: 1 });
            const { session, runShutdownTasks } = makeSession();
            fs.unlinkSync(filename);
            should(await open(session, file, OpenFileMode.Read)).eql(StatusCodes.BadUnexpectedError);
            should(getFileData(file).openCount).eql(0);

            fs.writeFileSync(filename, SEED);
            should(await open(session, file, OpenFileMode.Read)).eql(StatusCodes.Good);
            await runShutdownTasks();
        });
    });

    describe("file handle limit for the server", () => {
        it("has a default of 256 handles, above the 100 handles of a default server", () => {
            should(defaultMaxOpenFilesPerServer).eql(256);
        });

        it("the limit applies to all the sessions and to all the files, and a Close gives room again", async () => {
            const { file: file1 } = makeFile({ maxOpenFilesPerServer: 3 });
            const { file: file2 } = makeFile({ maxOpenFilesPerServer: 3 });
            const a = makeSession();
            const b = makeSession();
            const clientFile = new ClientFile(a.session, file1.nodeId);
            await clientFile.open(OpenFileMode.Read);
            should(await open(a.session, file2, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(await open(b.session, file1, OpenFileMode.Read)).eql(StatusCodes.Good);

            should(await open(a.session, file1, OpenFileMode.Read)).eql(StatusCodes.BadResourceUnavailable);
            should(await open(b.session, file2, OpenFileMode.Read)).eql(StatusCodes.BadResourceUnavailable);
            should(await open(makeSession().session, file1, OpenFileMode.Read)).eql(StatusCodes.BadResourceUnavailable);

            await clientFile.close();
            should(await open(b.session, file2, OpenFileMode.Read)).eql(StatusCodes.Good);
            await a.runShutdownTasks();
            await b.runShutdownTasks();
        });

        it("a closed session gives room again", async () => {
            const { file } = makeFile({ maxOpenFilesPerServer: 2 });
            const a = makeSession();
            const b = makeSession();
            should(await open(a.session, file, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(await open(a.session, file, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(await open(b.session, file, OpenFileMode.Read)).eql(StatusCodes.BadResourceUnavailable);

            await a.runShutdownTasks();
            should(getFileData(file).openCount).eql(0);
            should(await open(b.session, file, OpenFileMode.Read)).eql(StatusCodes.Good);
            await b.runShutdownTasks();
        });

        it("Open calls that come at the same time cannot pass the limit", async () => {
            const { file } = makeFile({ maxOpenFilesPerServer: 4 });
            const fixtures = [makeSession(), makeSession(), makeSession()];
            const calls = fixtures.flatMap(({ session }) => [1, 2, 3].map(() => open(session, file, OpenFileMode.Read)));
            const statusCodes = await Promise.all(calls);
            should(statusCodes.filter((statusCode) => statusCode === StatusCodes.Good).length).eql(4);
            should(getFileData(file).openCount).eql(4);
            await Promise.all(fixtures.map((fixture) => fixture.runShutdownTasks()));
        });

        it("a refused Open with EraseExisting keeps the content", async () => {
            const { file, filename } = makeFile({ maxOpenFilesPerServer: 1 });
            const a = makeSession();
            const b = makeSession();
            should(await open(a.session, file, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(await open(b.session, file, OpenFileMode.WriteEraseExisting)).eql(StatusCodes.BadResourceUnavailable);
            should(fs.readFileSync(filename, "utf8")).eql(SEED);
            await a.runShutdownTasks();
        });
    });

    describe("session shutdown", () => {
        it("releases all the handles of the session, and only these", async () => {
            const { file: file1 } = makeFile();
            const { file: file2 } = makeFile();
            const closing = makeSession();
            const other = makeSession();
            should(await open(closing.session, file1, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(await open(closing.session, file1, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(await open(closing.session, file2, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(await open(other.session, file1, OpenFileMode.Read)).eql(StatusCodes.Good);
            should(getFileData(file1).openCount).eql(3);
            should(getFileData(file2).openCount).eql(1);

            await closing.runShutdownTasks();
            should(getFileData(file1).openCount).eql(1);
            should(getFileData(file2).openCount).eql(0);

            await other.runShutdownTasks();
            should(getFileData(file1).openCount).eql(0);
        });

        it("registers one task per session, even after many Open and Close", async () => {
            const { file } = makeFile();
            const { session, taskCount } = makeSession();
            const clientFile = new ClientFile(session, file.nodeId);
            for (let i = 0; i < 3; i++) {
                await clientFile.open(OpenFileMode.Read);
                await clientFile.close();
            }
            should(taskCount()).eql(1);
        });

        it("does not close twice a handle that the client has closed", async () => {
            const { file } = makeFile();
            const { session, runShutdownTasks } = makeSession();
            const clientFile = new ClientFile(session, file.nodeId);
            await clientFile.open(OpenFileMode.Read);
            await clientFile.close();
            await runShutdownTasks();
            should(getFileData(file).openCount).eql(0);
        });
    });
});
