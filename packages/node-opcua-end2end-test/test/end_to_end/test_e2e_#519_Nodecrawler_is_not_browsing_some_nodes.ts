// tslint:disable:no-var-requires
// tslint:disable:no-empty

import {
    BrowseDescriptionLike,
    BrowseDirection,
    BrowseRequestOptions,
    BrowseResult,
    NodeClassMask,
    NodeId,
    OPCUAClient,
    OPCUAServer
} from "node-opcua";

const should = require("should");
const doDebug = false;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing monitoring Executable flags on methods", () => {
    let server: OPCUAServer;
    let endpointUrl: any;

    let port = 20000;
    let groupNodeId: NodeId;

    before(done => {
        port += 1;

        const options = { port };
        server = new OPCUAServer(options);

        server.on("post_initialize", () => {
            const addressSpace = server.engine.addressSpace!;

            const group = addressSpace.getOwnNamespace().addObject({
                browseName: "Group",
                organizedBy: addressSpace.rootFolder.objects
            });

            for (let i = 0; i < 27; i++) {
                addressSpace.getOwnNamespace().addObject({
                    browseName: "Object" + i,
                    organizedBy: group
                });
            }
            groupNodeId = group.nodeId;
        });
        server.start((err?: Error) => {
            if (err) {
                return done(err);
            }
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            if (err) {
                return done(err);
            }
            done();
        });
    });

    beforeEach(done => {
        done();
    });

    afterEach(done => {
        done();
    });
    after(async () => {
        await server.shutdown();
    });
    it("should browse a variable", async () => {
        const client = OPCUAClient.create({});
        await client.connect(endpointUrl);

        const session = await client.createSession();

        // we want a maximum of 10 refence per nodes
        session.requestedMaxReferencesPerNode = 10;
        const nodeToBrowse: BrowseDescriptionLike = {
            browseDirection: BrowseDirection.Forward,
            nodeClassMask: NodeClassMask.Object,
            nodeId: groupNodeId
        };

        const result: BrowseResult = await session.browse(nodeToBrowse);
        result.references!.length.should.eql(10);

        should.exist(result.continuationPoint);

        const resultNext1: BrowseResult = await session.browseNext(result.continuationPoint, false);

        resultNext1.references!.length.should.eql(10);

        should.exist(resultNext1.continuationPoint);

        const resultNext2: BrowseResult = await session.browseNext(resultNext1.continuationPoint, false);
        resultNext2.references!.length.should.eql(7);
        should.not.exist(resultNext2.continuationPoint);

        await session.close();

        await client.disconnect();
    });
});
