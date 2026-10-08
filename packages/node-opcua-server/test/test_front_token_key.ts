import { NodeId, NodeIdType } from "node-opcua-nodeid";
import should from "should";
import { tokenKeyOf } from "../dist/front_threads/token_key.js";

describe("tokenKeyOf: the key of a session token in the front threads", () => {
    const opaque = (bytes: Buffer, namespace = 1) => new NodeId(NodeIdType.BYTESTRING, bytes, namespace);

    it("is NodeId.toString(), the same for every decoded copy of a token", () => {
        const bytes = Buffer.alloc(32, 7);
        should(tokenKeyOf(opaque(Buffer.from(bytes)))).eql(opaque(bytes).toString());
        should(tokenKeyOf(opaque(Buffer.from(bytes)))).eql(opaque(bytes).toString());
    });

    it("tells apart tokens whose first bytes are the same", () => {
        const a = Buffer.alloc(32, 1);
        const b = Buffer.alloc(32, 1);
        b[31] = 2;
        should(tokenKeyOf(opaque(a))).eql(opaque(a).toString());
        should(tokenKeyOf(opaque(b))).eql(opaque(b).toString());
        should(tokenKeyOf(opaque(a))).not.eql(tokenKeyOf(opaque(b)));
    });

    it("tells apart the same bytes in two namespaces, and keys other tokens by their string", () => {
        const bytes = Buffer.alloc(32, 9);
        should(tokenKeyOf(opaque(bytes, 1))).not.eql(tokenKeyOf(opaque(bytes, 2)));
        should(tokenKeyOf(new NodeId(NodeIdType.NUMERIC, 42, 1))).eql("ns=1;i=42");
    });
});
