import fs from "fs";
import path from "path";
import should from "should";

import { OPCUAClient } from "node-opcua-client";
import { UserTokenType } from "node-opcua-service-endpoints";
import { NodeId } from "node-opcua-nodeid";

import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";
import { coercePrivateKeyPem, readPrivateKey } from "node-opcua-crypto";

import { OPCUAServer } from "../source";

const mini_nodeset_filename = get_mini_nodeset_filename();

fs.existsSync(mini_nodeset_filename).should.eql(true, " expecting " + mini_nodeset_filename + " to exist");

const port = 2022;

interface OPCUAServerPriv extends Omit<OPCUAServer, "createSession"> {
    createSession: (options?: any) => any;
}
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("OPCUAServer", () => {
    let server: OPCUAServerPriv | null = null;
    beforeEach(async () => {
        server = new OPCUAServer({
            port,
            nodeset_filename: [mini_nodeset_filename]
        }) as any as OPCUAServerPriv;
        await server.start();
    });
    afterEach(async () => {
        if (server) {
            await server.shutdown();
            server = null;
        }
    });

    it("should dismiss all existing sessions upon termination", async () => {
        if (!server) throw new Error("server is null");

        server.engine.currentSessionCount.should.equal(0);

        // let make sure that no session exists
        // (session and subscriptions )
        const session = server.createSession({});

        server.engine.currentSessionCount.should.equal(1);
        server.engine.cumulatedSessionCount.should.equal(1);

        await server.shutdown();

        server.engine.currentSessionCount.should.equal(0);
        server.engine.cumulatedSessionCount.should.equal(1);
        server = null;
    });

    it("server address space have a node matching session.nodeId", () => {
        if (!server) throw new Error("server is null");

        server.engine.currentSessionCount.should.equal(0);

        // let make sure that no session exists
        // (session and subscriptions )
        const session = server.createSession();

        session.sessionName = "SessionNameGivenByClient";
        // activate session
        session.status = "active";

        session.nodeId.should.be.instanceOf(NodeId);

        //xx session.nodeId.identifierType.should.eql(NodeId.NodeIdType.GUID);

        const sessionNode = server.engine.addressSpace!.findNode(session.nodeId)!;

        should(!!sessionNode).eql(true, " a session node must be found");

        sessionNode.nodeId.should.eql(session.nodeId);

        sessionNode.browseName.toString().should.eql("1:SessionNameGivenByClient");
    });
});

describe("OPCUAServer-2", () => {
    let server: OPCUAServer;

    before((done) => {
        fs.existsSync(mini_nodeset_filename).should.eql(true);

        const options = {
            port,
            nodeset_filename: [mini_nodeset_filename]
        };
        server = new OPCUAServer(options);
        server.start(done);
    });

    after(async () => {
        if (server) {
            await server.shutdown();
        }
    });

    it("#rejectedSessionCount", () => {
        server.rejectedSessionCount.should.eql(server.engine.rejectedSessionCount);
    });

    it("#rejectedRequestsCount", () => {
        server.rejectedRequestsCount.should.eql(server.engine.rejectedRequestsCount);
    });

    it("#sessionAbortCount", () => {
        server.sessionAbortCount.should.eql(server.engine.sessionAbortCount);
    });

    it("#publishingIntervalCount", () => {
        server.publishingIntervalCount.should.eql(server.engine.publishingIntervalCount);
    });

    it("#buildInfo", () => {
        server.buildInfo.should.eql(server.engine.buildInfo);
    });
});
describe("OPCUAServer-3", () => {
    let server: OPCUAServer;
    before(() => {
        server = new OPCUAServer();
    });

    it("checking IOPCUAServer properties before startup", () => {
        server.currentChannelCount.should.eql(0);
        server.rejectedSessionCount.should.eql(0);
        server.rejectedRequestsCount.should.eql(0);
        server.currentSubscriptionCount.should.eql(0);
        server.sessionAbortCount.should.eql(0);
        server.publishingIntervalCount.should.eql(0);
        server.currentSessionCount.should.eql(0);
        server.isAuditing.should.eql(false);
        should(server.getSession(NodeId.nullNodeId, true)).eql(null);
    });
});
describe("OPCUAServer-4", () => {
    let server: OPCUAServer;
    let client: OPCUAClient;
    const endpointUrl = `opc.tcp://localhost:${port}`;
    const privateKeyFile = path.join(__dirname, "utils", "private_key.pem");
    const privateKey1 = readPrivateKey(privateKeyFile);
    const privateKeyPem = coercePrivateKeyPem(privateKey1);

    before(async () => {
        client = OPCUAClient.create({
            endpointMustExist: false
        });
        const options = {
            port
        };
        server = new OPCUAServer(options);
        await server.start();
    });

    after(async () => {
        if (client) {
            await client.disconnect();
        }
        if (server) {
            await server.shutdown();
        }
    });

    it("an invalid certificate should not crash the server", async () => {
        let thrown = false;
        try {
            await client.connect(endpointUrl);
            await client.createSession({
                type: UserTokenType.Certificate,
                certificateData: Buffer.from("AZEAZE"),
                privateKey: privateKeyPem
            });
            should(true).eql(false); // should never be reached
        } catch (e) {
            if (!(e instanceof Error)) throw new Error("expecting an error");
            should(e.message.includes("BadUserSignatureInvalid")).eql(true);
            should(e.message.includes("0x80570000")).eql(true);
            thrown = true;
        }
        should(thrown).eql(true);
    });
});
