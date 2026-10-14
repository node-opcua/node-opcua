import { randomBytes } from "node:crypto";
import { type DerivedKeys, encryptBufferWithDerivedKeys, makeMessageChunkSignatureWithDerivedKeys } from "node-opcua-crypto";
import { DataValue } from "node-opcua-data-value";
import { MessageSecurityMode, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { ReadResponse, ResponseHeader } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import {
    computeDerivedKeys,
    getCryptoFactory,
    getOptionsForSymmetricSignAndEncrypt,
    type IDerivedKeyProvider,
    MessageBuilder,
    MessageChunker,
    SecureChunkWriter,
    SecurityPolicy,
    SequenceNumberGenerator
} from "../source/index.js";
import type { ChunkMessageParameters } from "../source/message_chunker.js";
import { chunkWithChunker, chunkWithChunkManager, encodeBody, managerMaxBodySize } from "./helpers/chunk_reference.js";

//
// Symmetric messages (MSG, CLO) are chunked by a SecureChunkWriter (ADR 0001) instead of the
// SecureMessageChunkManager/ChunkManager pair. Its bytes must be those the chunk managers produce:
// same headers, padding, signature and ciphertext, for one chunk and for several.
//
// The reference is the chunk manager path, driven through prepareChunk. Each side has its own
// chunker (so the sequence numbers start together) and its own copy of the derived keys (the
// symmetric cipher keeps its CBC chain per key object).
//

const chunkSize = 8192;
const channelId = 11;
const tokenId = 3;
const serverNonce = randomBytes(32);
const clientNonce = randomBytes(32);

function derivedKeysFor(securityPolicy: SecurityPolicy): DerivedKeys {
    const cryptoFactory = getCryptoFactory(securityPolicy);
    if (!cryptoFactory) throw new Error(`no crypto factory for ${securityPolicy}`);
    const keys = computeDerivedKeys(cryptoFactory, serverNonce, clientNonce).derivedServerKeys;
    if (!keys) throw new Error("no derived keys");
    return keys;
}

/** what the channel layers pass to chunkSecureMessage for a symmetric message */
function makeParams(
    securityMode: MessageSecurityMode,
    keys: DerivedKeys | null,
    requestId: number,
    token = tokenId
): ChunkMessageParameters {
    const securityOptions =
        securityMode === MessageSecurityMode.None || !keys ? null : getOptionsForSymmetricSignAndEncrypt(securityMode, keys);
    return {
        channelId,
        securityHeader: new SymmetricAlgorithmSecurityHeader({ tokenId: token }),
        securityOptions: {
            channelId,
            chunkSize,
            requestId,
            signatureLength: 0,
            plainBlockSize: 0,
            cipherBlockSize: 0,
            sequenceHeaderSize: 0,
            ...securityOptions
        }
    };
}

function keysOf(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): DerivedKeys | null {
    return securityMode === MessageSecurityMode.None ? null : derivedKeysFor(securityPolicy);
}

function makeResponse(payloadLength: number): ReadResponse {
    return new ReadResponse({
        responseHeader: new ResponseHeader({ timestamp: new Date(Date.UTC(2026, 0, 1)), requestHandle: 42 }),
        results: [
            new DataValue({
                value: new Variant({ dataType: DataType.ByteString, value: Buffer.alloc(payloadLength, 0xab) }),
                statusCode: StatusCodes.Good
            })
        ]
    });
}

function maxBodySize(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy): number {
    return managerMaxBodySize(securityMode, "MSG", makeParams(securityMode, keysOf(securityMode, securityPolicy), 1));
}

function makeBuilder(securityMode: MessageSecurityMode, securityPolicy: SecurityPolicy, maxChunkCount: number): MessageBuilder {
    const receiverKeys = keysOf(securityMode, securityPolicy);
    const derivedKeyProvider: IDerivedKeyProvider = { getDerivedKey: () => receiverKeys };
    const messageBuilder = new MessageBuilder(derivedKeyProvider, {
        name: "MessageBuilder",
        maxMessageSize: 1024 * 1024,
        maxChunkSize: chunkSize,
        maxChunkCount
    });
    messageBuilder.setSecurity(securityMode, securityPolicy);
    return messageBuilder;
}

const policies = [
    SecurityPolicy.Basic128Rsa15,
    SecurityPolicy.Basic256,
    SecurityPolicy.Basic256Sha256,
    SecurityPolicy.Aes128_Sha256_RsaOaep,
    SecurityPolicy.Aes256_Sha256_RsaPss
];
const cases: [MessageSecurityMode, SecurityPolicy][] = [[MessageSecurityMode.None, SecurityPolicy.None]];
for (const securityPolicy of policies) {
    cases.push([MessageSecurityMode.Sign, securityPolicy], [MessageSecurityMode.SignAndEncrypt, securityPolicy]);
}

describe("SecureChunkWriter: symmetric messages without the chunk managers", () => {
    for (const [securityMode, securityPolicy] of cases) {
        const name = `${MessageSecurityMode[securityMode]} ${securityPolicy.split("#")[1]}`;

        // body lengths from tiny to three chunks: every padding remainder, both sides of the one- and two-chunk limits
        const limit = maxBodySize(securityMode, securityPolicy);
        const overhead = encodeBody(makeResponse(0)).length;
        const bodyLengths = [overhead, overhead + 1, 100, 300, 1000, 4000];
        for (let i = 0; i < 17; i++) bodyLengths.push(500 + i);
        for (let d = -2; d <= 2; d++) bodyLengths.push(limit + d, 2 * limit + d);
        bodyLengths.push(2 * limit + 21);
        const messages = bodyLengths.map((length) => makeResponse(length - overhead));

        it(`SCW-1 ${name}: the same bytes as the chunk managers, MSG and CLO`, async () => {
            const referenceChunker = new MessageChunker({ securityMode });
            const chunker = new MessageChunker({ securityMode });
            const referenceKeys = keysOf(securityMode, securityPolicy);
            const keys = keysOf(securityMode, securityPolicy);
            for (let index = 0; index < messages.length; index++) {
                const message = messages[index];
                should(encodeBody(message).length).eql(bodyLengths[index]);
                const msgType = index % 7 === 3 ? "CLO" : "MSG";
                const expected = await chunkWithChunkManager(
                    referenceChunker,
                    msgType,
                    makeParams(securityMode, referenceKeys, index + 1),
                    message
                );
                const { statusCode, chunks, finished } = await chunkWithChunker(
                    chunker,
                    msgType,
                    makeParams(securityMode, keys, index + 1),
                    message
                );
                should(statusCode).eql(StatusCodes.Good);
                should(finished).eql(true);
                should(chunks.length).eql(Math.ceil(bodyLengths[index] / limit));
                should(chunks.length).eql(expected.length, `chunk count for a body of ${bodyLengths[index]}`);
                chunks.forEach((chunk, i) => {
                    should(chunk.toString("hex")).eql(expected[i].toString("hex"), `body of ${bodyLengths[index]} bytes`);
                });
            }
        });

        it(`SCW-2 ${name}: a MessageBuilder reads the chunks back`, async () => {
            const messageBuilder = makeBuilder(securityMode, securityPolicy, 10);
            const received: { message: ReadResponse; requestId: number }[] = [];
            const errors: Error[] = [];
            messageBuilder.on("message", (message, _msgType, _securityHeader, requestId) =>
                received.push({ message: message as ReadResponse, requestId })
            );
            messageBuilder.on("error", (err) => errors.push(err));

            const chunker = new MessageChunker({ securityMode });
            const keys = keysOf(securityMode, securityPolicy);
            for (let index = 0; index < messages.length; index++) {
                const { chunks } = await chunkWithChunker(
                    chunker,
                    "MSG",
                    makeParams(securityMode, keys, index + 1),
                    messages[index]
                );
                for (const chunk of chunks) {
                    messageBuilder.feed(chunk);
                }
            }
            should(errors).eql([]);
            should(received.length).eql(messages.length);
            received.forEach(({ message, requestId }, index) => {
                should(requestId).eql(index + 1);
                should(message.results?.[0].value.value).eql(messages[index].results?.[0].value.value);
            });
            messageBuilder.dispose();
        });

        it(`SCW-3 ${name}: the maxChunkCount and maxMessageSize refusals`, async () => {
            const twoChunks = makeResponse(limit + 1 - overhead);
            const keys = keysOf(securityMode, securityPolicy);

            // sender: refused before the first chunk
            const byCount = await chunkWithChunker(
                new MessageChunker({ securityMode, maxChunkCount: 1 }),
                "MSG",
                makeParams(securityMode, keys, 1),
                twoChunks
            );
            should(byCount.statusCode).eql(StatusCodes.BadTcpMessageTooLarge);
            should(byCount.chunks).eql([]);
            should(byCount.finished).eql(false);
            const bySize = await chunkWithChunker(
                new MessageChunker({ securityMode, maxMessageSize: limit }),
                "MSG",
                makeParams(securityMode, keys, 1),
                twoChunks
            );
            should(bySize.statusCode).eql(StatusCodes.BadTcpMessageTooLarge);
            should(bySize.chunks).eql([]);

            // receiver: a builder that takes one chunk refuses the second
            const { chunks } = await chunkWithChunker(
                new MessageChunker({ securityMode }),
                "MSG",
                makeParams(securityMode, keys, 1),
                twoChunks
            );
            should(chunks.length).eql(2);
            const messageBuilder = makeBuilder(securityMode, securityPolicy, 1);
            const statusCodes: StatusCode[] = [];
            messageBuilder.on("error", (_err, statusCode) => statusCodes.push(statusCode));
            for (const chunk of chunks) {
                messageBuilder.feed(chunk);
            }
            should(statusCodes).eql([StatusCodes.BadTcpMessageTooLarge]);
            messageBuilder.dispose();
        });

        it(`SCW-6 ${name}: maxBodySize is what maxChunkCount chunks of the chunk managers carry`, () => {
            const params = makeParams(securityMode, keysOf(securityMode, securityPolicy), 1);
            should(new MessageChunker({ securityMode, maxChunkCount: 3 }).maxBodySize("MSG", params)).eql(3 * limit);
            should(new MessageChunker({ securityMode, maxChunkCount: 3, maxMessageSize: limit }).maxBodySize("MSG", params)).eql(
                limit
            );
        });
    }

    it("SCW-4 a writer made from the derived keys writes what the chunker writes", async () => {
        const securityMode = MessageSecurityMode.SignAndEncrypt;
        const securityPolicy = SecurityPolicy.Basic256Sha256;
        const writer = new SecureChunkWriter({
            channelId,
            tokenId,
            securityMode,
            derivedKeys: derivedKeysFor(securityPolicy),
            chunkSize,
            maxMessageSize: 0,
            maxChunkCount: 0,
            sequenceNumberGenerator: new SequenceNumberGenerator()
        });
        should(writer.maxBodySizePerChunk).eql(maxBodySize(securityMode, securityPolicy));
        const chunker = new MessageChunker({ securityMode });
        const keys = derivedKeysFor(securityPolicy);
        for (const length of [10, 1000, 20000]) {
            const message = makeResponse(length);
            const chunks: Buffer[] = [];
            should(writer.writeMessage("MSG", 5, message, (chunk) => chunks.push(chunk))).eql(StatusCodes.Good);
            const expected = (await chunkWithChunker(chunker, "MSG", makeParams(securityMode, keys, 5), message)).chunks;
            should(Buffer.concat(chunks).toString("hex")).eql(Buffer.concat(expected).toString("hex"));
        }
    });

    it("SCW-5 the chunker follows a change of token", async () => {
        const securityMode = MessageSecurityMode.SignAndEncrypt;
        const securityPolicy = SecurityPolicy.Basic256Sha256;
        const referenceChunker = new MessageChunker({ securityMode });
        const chunker = new MessageChunker({ securityMode });
        // each side has its own key objects, so both start their CBC chains together
        const keys = [derivedKeysFor(securityPolicy), derivedKeysFor(securityPolicy)];
        const referenceKeys = [derivedKeysFor(securityPolicy), derivedKeysFor(securityPolicy)];
        const tokens = [0, 0, 1, 1, 0];
        for (let index = 0; index < tokens.length; index++) {
            const token = tokens[index];
            const message = makeResponse(100 * index);
            const expected = await chunkWithChunkManager(
                referenceChunker,
                "MSG",
                makeParams(securityMode, referenceKeys[token], index + 1, token + 1),
                message
            );
            const { chunks } = await chunkWithChunker(
                chunker,
                "MSG",
                makeParams(securityMode, keys[token], index + 1, token + 1),
                message
            );
            should(Buffer.concat(chunks).toString("hex")).eql(Buffer.concat(expected).toString("hex"));
        }
    });

    it("SCW-7 options made for every message do not cost an encode buffer per message", () => {
        // a caller that does not use getOptionsForSymmetricSignAndEncrypt builds new functions for each
        // message: the chunker then makes a writer per message, which must take over the encode buffer
        const securityMode = MessageSecurityMode.SignAndEncrypt;
        const keys = derivedKeysFor(SecurityPolicy.Basic256Sha256);
        const params = (requestId: number): ChunkMessageParameters => ({
            ...makeParams(securityMode, keys, requestId),
            securityOptions: {
                ...makeParams(securityMode, keys, requestId).securityOptions,
                signBufferFunc: (chunk: Buffer) => makeMessageChunkSignatureWithDerivedKeys(chunk, keys),
                encryptBufferFunc: (chunk: Buffer) => encryptBufferWithDerivedKeys(chunk, keys)
            }
        });
        const chunker = new MessageChunker({ securityMode });
        const callback = () => {
            /* chunks dropped */
        };
        chunker.chunkSecureMessage("MSG", params(1), makeResponse(10), callback);
        const sizes: number[] = [];
        const allocUnsafe = Buffer.allocUnsafe;
        Buffer.allocUnsafe = (size: number) => {
            sizes.push(size);
            return allocUnsafe(size);
        };
        try {
            chunker.chunkSecureMessage("MSG", params(2), makeResponse(10), callback);
        } finally {
            Buffer.allocUnsafe = allocUnsafe;
        }
        should(sizes.filter((size) => size >= SecureChunkWriter.minimumMessageSizeHint)).eql([]);
    });
});
