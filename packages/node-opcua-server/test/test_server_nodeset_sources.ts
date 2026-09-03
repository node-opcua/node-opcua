/**
 * A server loads its models through `nodesets`: file paths and sources in one list, loaded in
 * one call, so the standard nodeset given as a path satisfies what a streamed companion model
 * requires. The deprecated `nodeset_filename` still works and merges into the same load.
 * `nodesetLoaderOptions` reaches the loader.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { nodesetSourceFromGzipFile } from "node-opcua-address-space/nodeJS";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { OPCUAServer } from "../source/index.js";

const port = 2036;
const DI = "http://opcfoundation.org/UA/DI/";

describe("OPCUAServer loading nodesets from sources", function (this: Mocha.Suite) {
    this.timeout(60000);

    let diGzipFile: string;
    before(() => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nodeset-gz-"));
        diGzipFile = path.join(tmp, "Opc.Ua.Di.NodeSet2.xml.gz");
        fs.writeFileSync(diGzipFile, zlib.gzipSync(fs.readFileSync(nodesets.di)));
    });
    after(() => {
        fs.rmSync(path.dirname(diGzipFile), { recursive: true, force: true });
    });

    const expectDeviceSet = (server: OPCUAServer) => {
        const addressSpace = server.engine.addressSpace!;
        const diNamespace = addressSpace.getNamespace(DI);
        should.exist(diNamespace, "the DI namespace comes from the stream");
        diNamespace.findNode("i=5001")!.browseName.name!.should.eql("DeviceSet");
        should(addressSpace.getNamespaceArray()[1].namespaceUri).match(/^urn:/, "the server's own namespace stays at index 1");
    };

    it("loads a companion model given as a gzip file next to the standard nodeset path", async () => {
        const server = new OPCUAServer({
            port,
            nodesets: [nodesets.standard, nodesetSourceFromGzipFile(diGzipFile)],
            nodesetLoaderOptions: { yieldEveryBytes: 64 * 1024 }
        });
        try {
            await server.initialize();
            expectDeviceSet(server);
        } finally {
            await server.shutdown();
        }
    });

    it("merges the deprecated nodeset_filename with nodesets", async () => {
        const server = new OPCUAServer({
            port,
            nodeset_filename: [nodesets.standard],
            nodesets: [nodesetSourceFromGzipFile(diGzipFile)]
        });
        try {
            await server.initialize();
            expectDeviceSet(server);
        } finally {
            await server.shutdown();
        }
    });

    it("names the missing model when a source requires one that no path provides", async () => {
        const server = new OPCUAServer({
            port,
            nodesets: [nodesets.standard, { name: "adi.xml", source: () => fs.createReadStream(nodesets.adi) }]
        });
        try {
            await server.initialize().should.be.rejectedWith(/Cannot find namespace for http:\/\/opcfoundation.org\/UA\/DI\//);
        } finally {
            // a server that failed to initialize cannot be shut down; release what it had built
            server.engine.addressSpace?.dispose();
            server.dispose();
        }
    });
});
