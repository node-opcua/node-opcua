// tslint:disable:no-var-requires
// tslint:disable:no-empty

import {
    BrowseDescriptionLike,
    BrowseDirection,
    BrowseRequestOptions,
    BrowseResult,
    ClientSession,
    NodeClassMask,
    NodeId,
    OPCUAClient,
    OPCUAServer,
    browseAll
} from "node-opcua";
import { spy } from "sinon";

const should = require("should");
const doDebug = false;

// #519_NodeCrawler is not browsing some nodes
// #889
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing browse & browseNext", () => {
    let server: OPCUAServer;
    let endpointUrl: any;

    let port = 20000;
    let groupNodeId: NodeId;

    before(async () => {
        port += 1;

        const options = { port };
        server = new OPCUAServer(options);

        await server.initialize();
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
        await server.start();
        endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
    });

    let data: { session: ClientSession; client: OPCUAClient };
    beforeEach(async () => {
        const client = OPCUAClient.create({});
        await client.connect(endpointUrl);
        const session = await client.createSession();
        // we want a maximum of 10 references per nodes
        session.requestedMaxReferencesPerNode = 10;
        data = { client, session };
    });

    afterEach(async () => {
        const { session, client } = data;
        await session.close();
        await client.disconnect();
    });
    after(async () => {
        await server.shutdown();
    });

    it("should browse all references of a node using browse and browseNext", async () => {
        const { session } = data;

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
    });

    it("should browse all references using browseAll  ", async () => {
        const { session } = data;
        const nodeToBrowse: BrowseDescriptionLike = {
            browseDirection: BrowseDirection.Forward,
            nodeClassMask: NodeClassMask.Object,
            nodeId: groupNodeId
        };
        const browseSpy = spy(session, "browse");
        const browseNextSpy = spy(session, "browseNext");

        const result = await browseAll(session, nodeToBrowse);
        result.references!.length.should.eql(27);

        browseSpy.callCount.should.eql(1);
        browseNextSpy.callCount.should.eql(2);
    });
});
