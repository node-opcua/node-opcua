import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import "should";

import { NodeId, OPCUAClient, OPCUAServer, TransportSettings, UAFile } from "node-opcua";

import { ClientFile, installFileType, readOPCUAFile, writeOPCUAFile } from "..";

describe("FileType: Testing with very large file end-to-end", function () {
    this.timeout(100000);

    let server: OPCUAServer;

    let nodeId: NodeId;
    before(async () => {
        server = new OPCUAServer({
            port: 2000
        });

        await server.start();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();

        const filename = path.join(os.tmpdir(), "largeFileServerSide.bin");

        const fileType = addressSpace.findObjectType("FileType")!;
        // install file 1
        const opcuaFile = fileType.instantiate({
            browseName: "FileTransferObj",
            organizedBy: addressSpace.rootFolder.objects.server
        }) as UAFile;
        installFileType(opcuaFile, { filename, fileSystem: fs });

        nodeId = opcuaFile.nodeId;
    });
    after(async () => {
        await server.shutdown();
    });

    it("should write and read a very large file", async () => {
        if (!nodeId) return;

        const endpointUrl = server.getEndpointUrl();

        const veryLargeBuffer = Buffer.alloc(32 * 1024 * 1024);
        const filename = path.join(os.tmpdir(), "largeFile.bin");
        await fs.promises.writeFile(filename, veryLargeBuffer, "binary");
        console.log("large file created: at", filename, veryLargeBuffer.length);

        const transportSettings: TransportSettings = {
            maxMessageSize: 1024 * 1024 * 8,
        };
        const client = OPCUAClient.create({ transportSettings});

        await client.withSessionAsync(endpointUrl, async (session) => {
            console.log(client.toString());
            console.log("transport setting: ", session.toString());

            const clientFile = new ClientFile(session, nodeId);
            await writeOPCUAFile(clientFile, filename, { chunkSize: 4294967295});
            const bufferBack = await readOPCUAFile(clientFile);

            bufferBack.length.should.eql(veryLargeBuffer.length);
        });
    });
});
