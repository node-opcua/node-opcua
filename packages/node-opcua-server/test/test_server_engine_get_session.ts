import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers.js";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import should from "should";
import { ServerEngine } from "../source/index.js";

describe("ServerEngine - getSession", () => {
    let engine: ServerEngine;

    before((done) => {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: get_mini_nodeset_filename() }, () => done());
    });
    after(async () => {
        await engine.shutdown();
    });

    // a request carries its own copy of the token: the session is found by the bytes
    const copyOf = (token: NodeId) => new NodeId(NodeIdType.BYTESTRING, Buffer.from(token.value as Buffer), token.namespace);

    it("finds a session from a copy of its authentication token", () => {
        const session1 = engine.createSession({});
        const session2 = engine.createSession({});

        should(engine.getSession(copyOf(session1.authenticationToken))).equal(session1);
        should(engine.getSession(copyOf(session2.authenticationToken))).equal(session2);
        should(engine.getSession(copyOf(session2.authenticationToken), true)).equal(session2);

        engine.closeSession(session1.authenticationToken, true, "CloseSession");
        engine.closeSession(session2.authenticationToken, true, "CloseSession");
    });

    it("does not find a session from a token that is not exactly its own", () => {
        const session = engine.createSession({});
        const token = session.authenticationToken;
        const bytes = token.value as Buffer;

        const flipped = Buffer.from(bytes);
        flipped[flipped.length - 1] ^= 1;
        should(engine.getSession(new NodeId(NodeIdType.BYTESTRING, flipped))).not.be.ok();
        should(engine.getSession(new NodeId(NodeIdType.BYTESTRING, bytes.subarray(0, 8)))).not.be.ok();
        should(engine.getSession(new NodeId(NodeIdType.BYTESTRING, Buffer.from(bytes), 1))).not.be.ok();
        should(engine.getSession(new NodeId(NodeIdType.STRING, bytes.toString("latin1")))).not.be.ok();

        engine.closeSession(token, true, "CloseSession");
    });

    it("no longer finds a session that has been closed", () => {
        const session = engine.createSession({});
        const token = copyOf(session.authenticationToken);
        should(engine.getSession(token)).equal(session);

        engine.closeSession(session.authenticationToken, true, "CloseSession");
        should(engine.getSession(token)).not.be.ok();
    });
});
