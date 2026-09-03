/**
 * A server loads its models from files (`nodeset_filename`) and from sources (`nodesetSources`):
 * a gzip stream here, in one call with the files, so the standard nodeset given as a file
 * satisfies what the streamed companion model requires. `nodesetLoaderOptions` reaches the loader.
 */
import fs from "node:fs";
import zlib from "node:zlib";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { OPCUAServer } from "../source/index.js";

const port = 2036;
const DI = "http://opcfoundation.org/UA/DI/";

describe("OPCUAServer loading nodesets from sources", function (this: Mocha.Suite) {
    this.timeout(60000);

    it("loads a companion model given as a gzip stream next to the standard nodeset file", async () => {
        const server = new OPCUAServer({
            port,
            nodeset_filename: [nodesets.standard],
            nodesetSources: [
                {
                    name: "Opc.Ua.Di.NodeSet2.xml.gz",
                    source: () => fs.createReadStream(nodesets.di).pipe(zlib.createGzip()).pipe(zlib.createGunzip())
                }
            ],
            nodesetLoaderOptions: { yieldEveryBytes: 64 * 1024 }
        });
        try {
            await server.initialize();
            const addressSpace = server.engine.addressSpace!;
            const diNamespace = addressSpace.getNamespace(DI);
            should.exist(diNamespace, "the DI namespace comes from the stream");
            diNamespace.findNode("i=5001")!.browseName.name!.should.eql("DeviceSet");
            should(addressSpace.getNamespaceArray()[1].namespaceUri).match(/^urn:/, "the server's own namespace stays at index 1");
        } finally {
            await server.shutdown();
        }
    });

    it("names the missing model when a source requires one that no file provides", async () => {
        const server = new OPCUAServer({
            port,
            nodeset_filename: [nodesets.standard],
            nodesetSources: [{ name: "adi.xml", source: () => fs.createReadStream(nodesets.adi) }]
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
