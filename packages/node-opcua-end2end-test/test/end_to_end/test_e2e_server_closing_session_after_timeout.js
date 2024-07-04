"use strict";
const should = require("should");
const {
    OPCUAServer,
    OPCUAClient,
    get_empty_nodeset_filename,
    resolveNodeId,
    ReadRequest,
    TimestampsToReturn,
    AttributeIds,
    StatusCodes,
    SecurityPolicy,
    MessageSecurityMode
} = require("node-opcua");

const empty_nodeset_filename = get_empty_nodeset_filename();

const port = 2230;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing server dropping session after timeout if no activity has been recorded", function () {
    this.timeout(Math.max(200000, this.timeout()));

    let server;

    const nodeId = resolveNodeId("ns=0;i=2258");

    const readRequest = new ReadRequest({
        maxAge: 0,
        timestampsToReturn: TimestampsToReturn.Both,
        nodesToRead: [
            {
                nodeId: nodeId,
                attributeId: AttributeIds.Value
            }
        ]
    });

    let endpointUrl;

    const options = {
       
        defaultSecureTokenLifetime: 2000
    };

    before(async () => {
        server = new OPCUAServer({
            port,
            nodeset_filename: empty_nodeset_filename
        });
        await server.start();
        endpointUrl = server.getEndpointUrl();
        OPCUAServer.registry.count().should.eql(1);
    });

    after(async () => {
        await server.shutdown();
        OPCUAServer.registry.count().should.eql(0);
    });

    it("should not be able to read a node if no session has been opened ", async () => {
        const client = OPCUAClient.create(options);

        // given  client is connected, and have no session
        await client.connect(endpointUrl);

        // reading should fail with BadSessionIdInvalid
        const [err, response] = await new Promise((resolve, reject) => {
            client._secureChannel.performMessageTransaction(readRequest, (err, response) => {
                resolve([err, response]);
            });
        });
        await client.disconnect();
        if (response) {
            response.responseHeader.serviceResult.should.equal(StatusCodes.BadSessionIdInvalid);
        } else {
            should.exist(err);
            err.message.should.match(/BadSessionIdInvalid/);
        }
    });

    it("should denied service call with BadSessionClosed on a timed out session", async function () {
        const client = OPCUAClient.create(options);

        // given that client1 is connected, and have a session
        client.requestedSessionTimeout = 100;
        await client.connect(endpointUrl);

        server.currentSessionCount.should.eql(0);
        const session = await client.createSession();

        session.timeout.should.equal(100);
        server.currentSessionCount.should.eql(1);

        // now wait so that session times out on the server side
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // new behavior - client tries to restore session by recreating it !!!!
        server.currentSessionCount.should.eql(0);

        const err = await new Promise((resolve) => {
            session.read(readRequest.nodesToRead, (err, dataValues) => {
                resolve(err);
            });
        });
        await client.disconnect();
        should.not.exist(err, "read should end up without an error ");
    });
});
