import { BinaryStream } from "node-opcua-binary-stream";
import type { ConstantStatusCode } from "node-opcua-status-code";
import {
    decodeMessage,
    decodeReverseHello,
    HelloMessage,
    MAXIMUM_REVERSE_HELLO_FIELD_LENGTH,
    packTcpMessage,
    ReverseHelloMessage,
    validateReverseHelloFields
} from "..";

// decodeReverseHello throws an Error tagged with a transport-level statusCode (see
// ReverseHelloMessage.ts#makeTaggedError) instead of a dedicated error class.
type TaggedError = Error & { statusCode: ConstantStatusCode };

describe("testing ReverseHello (RHE) message encoding and decoding", () => {
    it("RHE-1 should encode and decode a ReverseHelloMessage via packTcpMessage/decodeMessage", () => {
        const reverseHello1 = new ReverseHelloMessage({
            serverUri: "urn:MyServer:Application",
            endpointUrl: "opc.tcp://192.168.0.1:26543/UA/Server"
        });

        const message = packTcpMessage("RHE", reverseHello1);

        // first 4 header bytes must be 'R' 'H' 'E' 'F'
        message.subarray(0, 4).toString("utf-8").should.eql("RHEF");

        const stream = new BinaryStream(message);
        const reverseHello2 = decodeMessage(stream, ReverseHelloMessage) as ReverseHelloMessage;

        reverseHello2.serverUri!.should.eql(reverseHello1.serverUri);
        reverseHello2.endpointUrl!.should.eql(reverseHello1.endpointUrl);
    });

    it("RHE-2 decodeReverseHello should parse a well-formed RHE chunk", () => {
        const reverseHello1 = new ReverseHelloMessage({
            serverUri: "urn:host:Server",
            endpointUrl: "opc.tcp://host:1234"
        });
        const message = packTcpMessage("RHE", reverseHello1);

        const decoded = decodeReverseHello(message);
        decoded.serverUri!.should.eql("urn:host:Server");
        decoded.endpointUrl!.should.eql("opc.tcp://host:1234");
    });

    it("RHE-3 decodeReverseHello should reject a non-RHE message (e.g. a HEL)", () => {
        const hello = new HelloMessage({ endpointUrl: "opc.tcp://host:1234" });
        const helloChunk = packTcpMessage("HEL", hello);

        let caught: TaggedError | undefined;
        try {
            decodeReverseHello(helloChunk);
        } catch (err) {
            caught = err as TaggedError;
        }
        should.exist(caught);
        caught.message.should.match(/RHE/);
        should.exist(caught.statusCode);
    });

    it("RHE-4 decodeReverseHello should reject an oversized field (> 4096 bytes)", () => {
        const bigUri = "x".repeat(MAXIMUM_REVERSE_HELLO_FIELD_LENGTH + 1);
        const reverseHello = new ReverseHelloMessage({
            serverUri: bigUri,
            endpointUrl: "opc.tcp://host:1234"
        });
        const message = packTcpMessage("RHE", reverseHello);

        let caught: TaggedError | undefined;
        try {
            decodeReverseHello(message);
        } catch (err) {
            caught = err as TaggedError;
        }
        should.exist(caught);
        caught.statusCode.name.should.match(/BadTcpEndpointUrlInvalid/);
    });

    it("RHE-5 validateReverseHelloFields should accept exactly 4096 bytes and reject 4097", () => {
        const okUri = "x".repeat(MAXIMUM_REVERSE_HELLO_FIELD_LENGTH);
        validateReverseHelloFields(new ReverseHelloMessage({ serverUri: okUri, endpointUrl: "opc.tcp://h:1" }));

        const tooBig = "x".repeat(MAXIMUM_REVERSE_HELLO_FIELD_LENGTH + 1);
        (() => validateReverseHelloFields(new ReverseHelloMessage({ serverUri: "a", endpointUrl: tooBig }))).should.throw();
    });

    it("RHE-6 should round-trip empty / null fields", () => {
        const reverseHello1 = new ReverseHelloMessage({});
        const message = packTcpMessage("RHE", reverseHello1);
        const decoded = decodeReverseHello(message);
        // null UAString round-trips as null
        should(decoded.serverUri).eql(reverseHello1.serverUri);
        should(decoded.endpointUrl).eql(reverseHello1.endpointUrl);
    });

    it("RHE-7 decodeReverseHello should reject a chunk shorter than the 8-byte header", () => {
        let caught: TaggedError | undefined;
        try {
            decodeReverseHello(Buffer.alloc(4));
        } catch (err) {
            caught = err as TaggedError;
        }
        should.exist(caught);
        caught.statusCode.name.should.match(/BadTcpMessageTypeInvalid/);
    });

    it("RHE-8 decodeReverseHello should reject a non-final chunk (isFinal !== 'F')", () => {
        const message = packTcpMessage("RHE", new ReverseHelloMessage({ serverUri: "urn:s", endpointUrl: "opc.tcp://h:1" }));
        message.write("C", 3, "binary"); // flip the 'F' (final) marker to 'C' (chunk)

        let caught: TaggedError | undefined;
        try {
            decodeReverseHello(message);
        } catch (err) {
            caught = err as TaggedError;
        }
        should.exist(caught);
        caught.message.should.match(/final/);
        caught.statusCode.name.should.match(/BadTcpMessageTypeInvalid/);
    });

    it("RHE-9 decodeReverseHello should reject a header whose declared length does not match the buffer", () => {
        const message = packTcpMessage("RHE", new ReverseHelloMessage({ serverUri: "urn:s", endpointUrl: "opc.tcp://h:1" }));
        message.writeUInt32LE(message.length + 100, 4); // corrupt the declared length

        let caught: TaggedError | undefined;
        try {
            decodeReverseHello(message);
        } catch (err) {
            caught = err as TaggedError;
        }
        should.exist(caught);
        caught.statusCode.name.should.match(/BadTcpMessageTooLarge/);
    });

    it("RHE-10 decodeReverseHello should reject a well-framed but undecodable body", () => {
        // 8-byte RHE header (declared length == buffer length) + a serverUri UAString whose length
        // prefix claims far more bytes than the buffer holds -> the field decode throws.
        const frame = Buffer.alloc(12);
        frame.write("RHEF", 0, "binary");
        frame.writeUInt32LE(12, 4); // declared length matches the buffer
        frame.writeUInt32LE(0x1000_0000, 8); // bogus UAString length (~256 MB)

        let caught: TaggedError | undefined;
        try {
            decodeReverseHello(frame);
        } catch (err) {
            caught = err as TaggedError;
        }
        should.exist(caught);
        caught.statusCode.name.should.match(/BadTcpEndpointUrlInvalid/);
    });

    it("RHE-11 toString() renders the serverUri and endpointUrl", () => {
        const s = new ReverseHelloMessage({ serverUri: "urn:my:Server", endpointUrl: "opc.tcp://host:1234" }).toString();
        s.should.match(/urn:my:Server/);
        s.should.match(/opc.tcp:\/\/host:1234/);
    });
});
