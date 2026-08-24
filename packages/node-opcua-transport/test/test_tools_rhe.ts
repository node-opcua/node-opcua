import { BinaryStream } from "node-opcua-binary-stream";
import { readMessageHeader } from "node-opcua-chunkmanager";
import { packTcpMessage, ReverseHelloMessage } from "..";

describe("testing that the transport tools accept the RHE message type", () => {
    it("RHE-TOOLS-1 packTcpMessage should accept 'RHE' and write a well-formed header", () => {
        const reverseHello = new ReverseHelloMessage({
            serverUri: "urn:s",
            endpointUrl: "opc.tcp://h:1"
        });
        const chunk = packTcpMessage("RHE", reverseHello);

        const header = readMessageHeader(new BinaryStream(chunk));
        header.msgType.should.eql("RHE");
        header.isFinal.should.eql("F");
        header.length.should.eql(chunk.length);
    });

    it("RHE-TOOLS-2 packTcpMessage should still reject an unknown 3-char message type", () => {
        const reverseHello = new ReverseHelloMessage({ serverUri: "urn:s", endpointUrl: "opc.tcp://h:1" });
        (() => packTcpMessage("XXX", reverseHello)).should.throw();
    });
});
