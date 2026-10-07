import { encodeArray } from "node-opcua-basic-types";
import { BinaryStream, BinaryStreamSizeCalculator } from "node-opcua-binary-stream";
import { DataValue } from "node-opcua-data-value";
import { MessageSecurityMode, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { ReadRequest, RequestHeader, WriteRequest, WriteValue } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import {
    encodedNodesToWrite,
    forgetEncodedNodesToWrite,
    type IDerivedKeyProvider,
    MessageBuilder,
    MessageChunker,
    SecurityPolicy
} from "../dist/source/index.js";

/** the Value attribute (node-opcua-data-model is not a dependency of this package) */
const VALUE = 13;

const derivedKeyProvider: IDerivedKeyProvider = {
    getDerivedKey(_tokenId: number) {
        return null;
    }
};

/** chunks `request` as a client sends it, and decodes it back as a server receives it */
async function sendAndReceive(request: WriteRequest | ReadRequest, chunkSize: number): Promise<WriteRequest | ReadRequest> {
    const chunks: Buffer[] = [];
    const chunker = new MessageChunker({ securityMode: MessageSecurityMode.None });
    await new Promise<void>((resolve) => {
        chunker.chunkSecureMessage(
            "MSG",
            {
                channelId: 1,
                securityHeader: new SymmetricAlgorithmSecurityHeader(),
                securityOptions: {
                    requestId: 1,
                    cipherBlockSize: 0,
                    plainBlockSize: 0,
                    sequenceHeaderSize: 0,
                    signatureLength: 0,
                    channelId: 1,
                    chunkSize
                }
            },
            request,
            (chunk?: Buffer | null) => (chunk ? chunks.push(Buffer.from(chunk)) : resolve())
        );
    });
    const builder = new MessageBuilder(derivedKeyProvider, { name: "server" });
    builder.setSecurity(MessageSecurityMode.None, SecurityPolicy.None);
    return new Promise((resolve, reject) => {
        builder.on("message", (message) => resolve(message as WriteRequest)).on("error", (err) => reject(new Error(`${err}`)));
        for (const chunk of chunks) builder.feed(chunk);
    });
}

function encodedArrayOf(nodesToWrite: WriteValue[]): Buffer {
    const size = new BinaryStreamSizeCalculator();
    encodeArray(nodesToWrite, size, (w, s) => w.encode(s));
    const stream = new BinaryStream(size.length);
    encodeArray(nodesToWrite, stream, (w, s) => w.encode(s));
    return stream.buffer.subarray(0, stream.length);
}

describe("the bytes the WriteValues of a WriteRequest arrived as", () => {
    const nodesToWrite = Array.from(
        { length: 300 },
        (_, k) =>
            new WriteValue({
                nodeId: `ns=1;i=${1000 + k}`,
                attributeId: VALUE,
                value: new DataValue({ value: new Variant({ dataType: DataType.Int32, value: k }) })
            })
    );

    it("are kept, the request header skipped, when the request spans several chunks", async () => {
        const request = new WriteRequest({
            // a header of a length of its own: the WriteValues start wherever it ends
            requestHeader: new RequestHeader({ auditEntryId: "an audit entry id", requestHandle: 42 }),
            nodesToWrite
        });
        const received = (await sendAndReceive(request, 2048)) as WriteRequest;
        const nodes = received.nodesToWrite as WriteValue[];
        should(nodes.length).eql(300);
        const bytes = encodedNodesToWrite(nodes);
        should(bytes).not.eql(undefined);
        should(Buffer.from(bytes as Uint8Array)).eql(encodedArrayOf(nodesToWrite));
    });

    it("are forgotten once the WriteValues have been changed", async () => {
        const received = (await sendAndReceive(new WriteRequest({ nodesToWrite }), 65536)) as WriteRequest;
        const nodes = received.nodesToWrite as WriteValue[];
        should(encodedNodesToWrite(nodes)).not.eql(undefined);
        forgetEncodedNodesToWrite(nodes);
        should(encodedNodesToWrite(nodes)).eql(undefined);
    });

    it("are not kept for another request", async () => {
        const received = (await sendAndReceive(
            new ReadRequest({ nodesToRead: [{ nodeId: "ns=1;i=1", attributeId: VALUE }] }),
            65536
        )) as ReadRequest & { nodesToWrite?: unknown[] };
        should(received.nodesToWrite).eql(undefined);
        should(encodedNodesToWrite(received.nodesToRead as unknown[])).eql(undefined);
    });
});
