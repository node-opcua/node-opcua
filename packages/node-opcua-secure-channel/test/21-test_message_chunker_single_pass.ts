import { DataValue } from "node-opcua-data-value";
import { MessageSecurityMode, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { StatusCodes } from "node-opcua-status-code";
import { ReadResponse, ResponseHeader } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { MessageChunker } from "../source";
// ChunkMessageParameters is not re-exported by the source barrel; import it from its defining module
import type { ChunkMessageParameters } from "../source/message_chunker";

//
// chunkSecureMessage used to size the message with a BinaryStreamSizeCalculator and then
// encode it a second time into an exactly-sized buffer. It now encodes once into a
// growable stream and takes the length from the cursor.
//
// Two things that used to be free now have to be asserted:
//   - the growable buffer is usually larger than the message, so the chunker must be
//     handed stream.length and not stream.buffer.length, or it ships uninitialised bytes
//   - the oversize check now happens after the body is materialised, so growth has to be
//     capped or an oversize message could make the server allocate without bound
//
// Note that two encodes of the same message through the same chunker are NOT
// byte-identical: the SequenceHeader carries an incrementing sequence number. Lengths are
// comparable, and one test below pins exactly which byte is allowed to move.
//

/** the chunker rounds up to whole chunks, so any message costs at least one chunk */
const ONE_CHUNK = 8192;

function makeOptions(chunkSize: number): ChunkMessageParameters {
    return {
        channelId: 1,
        securityHeader: new SymmetricAlgorithmSecurityHeader({ tokenId: 1 }),
        securityOptions: {
            requestId: 7,
            cipherBlockSize: 0,
            plainBlockSize: 0,
            sequenceHeaderSize: 0,
            signatureLength: 0,
            channelId: 1,
            chunkSize
        }
    };
}

function makeReadResponse(count: number): ReadResponse {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(
            new DataValue({
                value: new Variant({ dataType: DataType.Double, value: i * 1.5 }),
                statusCode: StatusCodes.Good
            })
        );
    }
    return new ReadResponse({
        responseHeader: new ResponseHeader({ timestamp: new Date(Date.UTC(2026, 0, 1)), requestHandle: 42 }),
        results
    });
}

function chunkAll(chunker: MessageChunker, message: ReadResponse, chunkSize = 0) {
    const chunks: Buffer[] = [];
    const statusCode = chunker.chunkSecureMessage("MSG", makeOptions(chunkSize), message, (chunk) => {
        if (chunk) {
            chunks.push(Buffer.from(chunk));
        }
    });
    return { statusCode, bytes: Buffer.concat(chunks), count: chunks.length };
}

function freshChunker(maxMessageSize?: number) {
    return new MessageChunker({ securityMode: MessageSecurityMode.None, maxMessageSize });
}

describe("MessageChunker single-pass encoding", () => {
    it("should emit the message, not the capacity of the growable buffer", () => {
        // the growable stream starts at MessageChunker.minimumMessageSizeHint (4 KiB); a
        // tiny message must not drag that whole buffer onto the wire
        const { statusCode, bytes } = chunkAll(freshChunker(), makeReadResponse(1));

        statusCode.should.eql(StatusCodes.Good);
        bytes.length.should.be.lessThan(
            MessageChunker.minimumMessageSizeHint,
            "emitted far more than the message: the buffer tail is being shipped"
        );
    });

    it("should emit the same length for the same message twice on one chunker", () => {
        const chunker = freshChunker();

        const first = chunkAll(chunker, makeReadResponse(5));
        const second = chunkAll(chunker, makeReadResponse(5));

        second.bytes.length.should.eql(first.bytes.length);
    });

    it("should differ only in the sequence number between two identical messages", () => {
        // pins what is *allowed* to change between consecutive messages, so a future
        // regression that perturbs anything else in the frame is caught here
        const chunker = freshChunker();

        const first = chunkAll(chunker, makeReadResponse(0)).bytes;
        const second = chunkAll(chunker, makeReadResponse(0)).bytes;

        first.length.should.eql(second.length);
        const differing: number[] = [];
        for (let i = 0; i < first.length; i++) {
            if (first[i] !== second[i]) {
                differing.push(i);
            }
        }
        // 0..11 message header, 12..15 symmetric SecurityHeader (tokenId),
        // 16..19 SequenceHeader.sequenceNumber - only that field may move
        differing.every((offset) => offset >= 16 && offset < 20).should.eql(true, `unexpected differing offsets ${differing}`);
    });

    it("should be unaffected by a previous larger message on the same chunker", () => {
        // after a big message the growable buffer stays big; a small message must still
        // report its own length rather than the retained capacity
        const reused = freshChunker();
        chunkAll(reused, makeReadResponse(500));

        const afterBig = chunkAll(reused, makeReadResponse(2));
        const onFresh = chunkAll(freshChunker(), makeReadResponse(2));

        afterBig.bytes.length.should.eql(onFresh.bytes.length);
    });

    it("should grow across messages of increasing size without corrupting any of them", () => {
        const reused = freshChunker();

        for (const count of [1, 4, 40, 400, 2]) {
            const grown = chunkAll(reused, makeReadResponse(count));
            const pristine = chunkAll(freshChunker(), makeReadResponse(count));
            grown.bytes.length.should.eql(pristine.bytes.length, `message with ${count} values differed after reuse`);
        }
    });

    it("should reject a message that exceeds the negotiated maximum size", () => {
        const chunker = freshChunker(2 * ONE_CHUNK);

        const { statusCode, count } = chunkAll(chunker, makeReadResponse(5000));

        statusCode.should.eql(StatusCodes.BadTcpMessageTooLarge);
        count.should.eql(0, "nothing should be emitted for a rejected message");
    });

    it("should keep working after a message was rejected for being too large", () => {
        // the rejection happens mid-encode now, so the chunker must not be left wedged
        const chunker = freshChunker(2 * ONE_CHUNK);

        chunkAll(chunker, makeReadResponse(5000)).statusCode.should.eql(StatusCodes.BadTcpMessageTooLarge);

        const { statusCode, count } = chunkAll(chunker, makeReadResponse(2));
        statusCode.should.eql(StatusCodes.Good);
        count.should.be.greaterThan(0);
    });

    it("should still enforce the chunk count limit", () => {
        const chunker = new MessageChunker({ securityMode: MessageSecurityMode.None, maxChunkCount: 1 });

        const { statusCode } = chunkAll(chunker, makeReadResponse(5000), 1024);

        statusCode.should.eql(StatusCodes.BadTcpMessageTooLarge);
    });

    it("should never report Good for a message beyond the ceiling", () => {
        const chunker = freshChunker(256);

        for (const count of [1, 100, 5000]) {
            const { statusCode } = chunkAll(chunker, makeReadResponse(count));
            should(statusCode.name).not.eql("Good", `${count} values should not have been accepted`);
        }
    });
});
