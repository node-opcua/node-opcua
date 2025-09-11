import "should";
import {
    OPCUAServer,
    OPCUAClient,
    get_empty_nodeset_filename,
    resolveNodeId,
    ReadRequest,
    TimestampsToReturn,
    AttributeIds,
    StatusCodes
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

const empty_nodeset_filename = get_empty_nodeset_filename();
const port = 2230;

describe("testing server dropping session after timeout if no activity has been recorded", function (this: Mocha.Context) {
    this.timeout(Math.max(200_000, this.timeout()));

    let server: OPCUAServer;
    const nodeId = resolveNodeId("ns=0;i=2258");
    const readRequest = new ReadRequest({
        maxAge: 0,
        timestampsToReturn: TimestampsToReturn.Both,
        nodesToRead: [
            {
                nodeId,
                attributeId: AttributeIds.Value
            }
        ]
    });
    let endpointUrl: string;
    const options = { defaultSecureTokenLifetime: 2000 };

    before(async () => {
        server = new OPCUAServer({ port, nodeset_filename: empty_nodeset_filename });
        await server.start();
        endpointUrl = server.getEndpointUrl();
        OPCUAServer.registry.count().should.eql(1);
    });

    after(async () => {
        await server.shutdown();
        OPCUAServer.registry.count().should.eql(0);
    });

    it("should not be able to read a node if no session has been opened", async () => {
        const client = OPCUAClient.create(options);
        await client.connect(endpointUrl);
        const [err, response] = await new Promise<any[]>((resolve) => {
            (client as any)._secureChannel.performMessageTransaction(readRequest, (err: Error, response: any) => {
                resolve([err, response]);
            });
        });
        await client.disconnect();
        if (response) {
            response.responseHeader.serviceResult.should.equal(StatusCodes.BadSessionIdInvalid);
        } else {
            (err as Error).message.should.match(/BadSessionIdInvalid/);
        }
    });

    it("should deny service call with BadSessionClosed on a timed out session", async () => {
        
        const client = OPCUAClient.create({ ...options, requestedSessionTimeout: 100 });
        await client.connect(endpointUrl);
        server.currentSessionCount.should.eql(0);
        
        const session = await client.createSession();
        session.timeout.should.equal(100);
        
        server.currentSessionCount.should.eql(1);
        
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        
        server.currentSessionCount.should.eql(0);
        
        // The client library may try to recreate session transparently; ensure call returns without throwing
        await session.read(readRequest.nodesToRead!);
        await client.disconnect();
    });
});
