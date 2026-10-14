import { createHash, createPublicKey, randomBytes } from "node:crypto";
import {
    CertificatePurpose,
    convertPEMtoDER,
    createSelfSignedCertificate,
    generatePrivateKey,
    keyOperationsFromPrivateKey,
    makePrivateKeyFromPem,
    makeSHA1Thumbprint,
    privateKeyToPEM
} from "node-opcua-crypto";
import type { BaseUAObject } from "node-opcua-factory";
import {
    AsymmetricAlgorithmSecurityHeader,
    MessageSecurityMode,
    OpenSecureChannelRequest,
    SecurityTokenRequestType,
    SymmetricAlgorithmSecurityHeader
} from "node-opcua-service-secure-channel";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import {
    computeDerivedKeys,
    getCryptoFactory,
    getOptionsForSymmetricSignAndEncrypt,
    getSignParams,
    MessageBuilder,
    MessageChunker,
    type SecureMessageData,
    SecurityPolicy,
    toCryptoKeyObject
} from "../source/index.js";
import type { ChunkMessageParameters } from "../source/message_chunker.js";
import {
    chunkWithChunker as chunkMessage,
    chunkWithChunkManager as chunkMessageWithManagers,
    encodeBody,
    managerMaxBodySize
} from "./helpers/chunk_reference.js";

//
// OpenSecureChannel goes through the SecureChunkWriter too (ADR 0001): an asymmetric security header
// of variable length, RSA encryption that turns each plain block into a larger cipher block, the
// ExtraPaddingSize byte of keys larger than 2048 bits, and a signature that may be asynchronous (a key
// held by a remote HSM/KMS provider).
//
// RSA encryption (OAEP, PKCS#1 v1.5) and RSA-PSS signatures are randomised, so the byte comparison
// with the chunk managers uses deterministic stand-ins with the same lengths: what is signed, what is
// encrypted, the headers and the padding must be the same. The real algorithms are covered by the
// round trip through a MessageBuilder.
//

const chunkSize = 8192;
const channelId = 21;
const keySizes = [1024, 2048, 3072, 4096] as const;
type KeySize = (typeof keySizes)[number];
const policies = [
    SecurityPolicy.Basic128Rsa15,
    SecurityPolicy.Basic256,
    SecurityPolicy.Basic256Sha256,
    SecurityPolicy.Aes128_Sha256_RsaOaep,
    SecurityPolicy.Aes256_Sha256_RsaPss
];

interface Identity {
    privateKeyPem: string;
    certificate: Buffer;
    certificatePem: string;
}
const identities = new Map<KeySize, Identity>();

async function makeIdentity(keySize: KeySize): Promise<Identity> {
    const cryptoKey = await generatePrivateKey(keySize);
    const { privPem } = await privateKeyToPEM(cryptoKey);
    const { cert } = await createSelfSignedCertificate({
        privateKey: cryptoKey,
        subject: `CN=writer-test-${keySize}`,
        applicationUri: `urn:writer-test-${keySize}`,
        purpose: CertificatePurpose.ForApplication
    });
    return { privateKeyPem: privPem, certificate: convertPEMtoDER(cert), certificatePem: cert };
}

function identity(keySize: KeySize): Identity {
    const found = identities.get(keySize);
    if (!found) throw new Error(`no identity for ${keySize}`);
    return found;
}

function cryptoFactoryOf(securityPolicy: SecurityPolicy) {
    const cryptoFactory = getCryptoFactory(securityPolicy);
    if (!cryptoFactory) throw new Error(`no crypto factory for ${securityPolicy}`);
    return cryptoFactory;
}

function makeRequest(nonceLength: number): OpenSecureChannelRequest {
    return new OpenSecureChannelRequest({
        clientProtocolVersion: 0,
        requestType: SecurityTokenRequestType.Issue,
        securityMode: MessageSecurityMode.SignAndEncrypt,
        clientNonce: Buffer.alloc(nonceLength, 0x5a),
        requestedLifetime: 600000
    });
}

function makeHeader(securityPolicy: SecurityPolicy, senderKeySize: KeySize, receiverKeySize: KeySize, encrypted: boolean) {
    return new AsymmetricAlgorithmSecurityHeader({
        securityPolicyUri: securityPolicy,
        senderCertificate: identity(senderKeySize).certificate,
        receiverCertificateThumbprint: encrypted ? makeSHA1Thumbprint(identity(receiverKeySize).certificate) : null
    });
}

/** stand-ins with the lengths of RSA: a signature of the modulus length, and plainBlockSize -> cipherBlockSize */
function deterministicSecurity(securityPolicy: SecurityPolicy, senderKeySize: KeySize, receiverKeySize: KeySize, async: boolean) {
    const signatureLength = senderKeySize / 8;
    const cipherBlockSize = receiverKeySize / 8;
    const plainBlockSize = cipherBlockSize - cryptoFactoryOf(securityPolicy).blockPaddingSize;
    const expand = (seed: Buffer, length: number) => {
        const out = Buffer.alloc(length);
        for (let i = 0; i * 32 < length; i++) {
            createHash("sha256")
                .update(seed)
                .update(String(i))
                .digest()
                .copy(out, i * 32);
        }
        return out;
    };
    const sign = (buffer: Buffer) => expand(buffer, signatureLength);
    const encrypt = (buffer: Buffer) => {
        should(buffer.length % plainBlockSize).eql(0);
        const blocks: Buffer[] = [];
        for (let i = 0; i < buffer.length; i += plainBlockSize) {
            const block = buffer.subarray(i, i + plainBlockSize);
            blocks.push(block, expand(block, cipherBlockSize - plainBlockSize));
        }
        return Buffer.concat(blocks);
    };
    const options: SecureMessageData = {
        signatureLength,
        cipherBlockSize,
        plainBlockSize,
        encryptBufferFunc: encrypt,
        ...(async
            ? {
                  signBufferAsyncFunc: (buffer: Buffer) =>
                      new Promise<Buffer>((resolve) => setImmediate(() => resolve(sign(buffer))))
              }
            : { signBufferFunc: sign })
    };
    return options;
}

/** the options a channel builds for OPN (see #_get_security_options_for_OPN of the channel layers) */
function realSecurity(
    securityPolicy: SecurityPolicy,
    senderKeySize: KeySize,
    receiverKeySize: KeySize,
    async: boolean
): SecureMessageData {
    const cryptoFactory = cryptoFactoryOf(securityPolicy);
    const keyOperations = keyOperationsFromPrivateKey(makePrivateKeyFromPem(identity(senderKeySize).privateKeyPem));
    const signParams = getSignParams(cryptoFactory);
    const receiverPublicKey = toCryptoKeyObject(createPublicKey(identity(receiverKeySize).certificatePem));
    const keyLength = receiverKeySize / 8;
    return {
        signatureLength: senderKeySize / 8,
        ...(async
            ? { signBufferAsyncFunc: (chunk: Buffer) => keyOperations.sign(chunk, signParams) }
            : { signBufferFunc: (chunk: Buffer) => keyOperations.signSync(chunk, signParams) }),
        cipherBlockSize: keyLength,
        plainBlockSize: keyLength - cryptoFactory.blockPaddingSize,
        encryptBufferFunc: (chunk) => cryptoFactory.asymmetricEncrypt(chunk, receiverPublicKey)
    };
}

function makeParams(
    header: AsymmetricAlgorithmSecurityHeader,
    security: SecureMessageData | null,
    requestId: number
): ChunkMessageParameters {
    return {
        channelId,
        securityHeader: header,
        securityOptions: {
            channelId,
            chunkSize,
            requestId,
            signatureLength: 0,
            plainBlockSize: 0,
            cipherBlockSize: 0,
            sequenceHeaderSize: 0,
            ...security
        }
    };
}

function encodedLength(message: BaseUAObject): number {
    return encodeBody(message).length;
}

/** the reference: the chunk managers, as the chunker used them for OPN before */
function chunkWithChunkManager(chunker: MessageChunker, params: ChunkMessageParameters, message: BaseUAObject) {
    return chunkMessageWithManagers(chunker, "OPN", params, message);
}

function chunkWithChunker(chunker: MessageChunker, params: ChunkMessageParameters, message: BaseUAObject) {
    return chunkMessage(chunker, "OPN", params, message);
}

function maxBodySize(securityMode: MessageSecurityMode, params: ChunkMessageParameters): number {
    return managerMaxBodySize(securityMode, "OPN", params);
}

/** requests whose body sizes sweep the padding remainders and both sides of the one- and two-chunk limits */
function requestsAround(limit: number): OpenSecureChannelRequest[] {
    const overhead = encodedLength(makeRequest(0));
    const bodyLengths = [overhead, overhead + 100, 1000];
    for (let i = 0; i < 9; i++) bodyLengths.push(1500 + i * 7);
    for (let d = -2; d <= 2; d++) bodyLengths.push(limit + d, 2 * limit + d);
    return bodyLengths.map((length) => makeRequest(length - overhead));
}

describe("SecureChunkWriter: OpenSecureChannel", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 120_000));

    before(async () => {
        for (const keySize of keySizes) {
            identities.set(keySize, await makeIdentity(keySize));
        }
    });

    describe("the same bytes as the chunk managers", () => {
        const cases: [SecurityPolicy, KeySize, KeySize][] = [];
        for (const securityPolicy of policies) {
            for (const keySize of keySizes) {
                cases.push([securityPolicy, keySize, keySize]);
            }
        }
        cases.push([SecurityPolicy.Basic256Sha256, 2048, 4096], [SecurityPolicy.Basic256Sha256, 4096, 2048]);

        for (const [securityPolicy, senderKeySize, receiverKeySize] of cases) {
            for (const securityMode of [MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt]) {
                for (const async of [false, true]) {
                    const name = `${securityPolicy.split("#")[1]} ${senderKeySize}/${receiverKeySize} ${MessageSecurityMode[securityMode]}${async ? " async" : ""}`;
                    it(`OPN-1 ${name}`, async () => {
                        const header = makeHeader(securityPolicy, senderKeySize, receiverKeySize, true);
                        const security = deterministicSecurity(securityPolicy, senderKeySize, receiverKeySize, async);
                        const limit = maxBodySize(securityMode, makeParams(header, security, 1));
                        should(
                            new MessageChunker({ securityMode, maxChunkCount: 3 }).maxBodySize(
                                "OPN",
                                makeParams(header, security, 1)
                            )
                        ).eql(3 * limit);
                        const referenceChunker = new MessageChunker({ securityMode });
                        const chunker = new MessageChunker({ securityMode });
                        let requestId = 0;
                        for (const message of requestsAround(limit)) {
                            requestId++;
                            const expected = await chunkWithChunkManager(
                                referenceChunker,
                                makeParams(header, security, requestId),
                                message
                            );
                            const { statusCode, chunks, finished } = await chunkWithChunker(
                                chunker,
                                makeParams(header, security, requestId),
                                message
                            );
                            should(statusCode).eql(StatusCodes.Good);
                            should(finished).eql(true);
                            should(chunks.length).eql(Math.ceil(encodedLength(message) / limit));
                            should(chunks.length).eql(expected.length);
                            chunks.forEach((chunk, i) => {
                                should(chunk.toString("hex")).eql(
                                    expected[i].toString("hex"),
                                    `body of ${encodedLength(message)} bytes`
                                );
                            });
                        }
                    });
                }
            }
        }

        it("OPN-1 None", async () => {
            const header = new AsymmetricAlgorithmSecurityHeader({
                securityPolicyUri: SecurityPolicy.None,
                senderCertificate: null,
                receiverCertificateThumbprint: null
            });
            const securityMode = MessageSecurityMode.None;
            const limit = maxBodySize(securityMode, makeParams(header, null, 1));
            const referenceChunker = new MessageChunker({ securityMode });
            const chunker = new MessageChunker({ securityMode });
            let requestId = 0;
            for (const message of requestsAround(limit)) {
                requestId++;
                const expected = await chunkWithChunkManager(referenceChunker, makeParams(header, null, requestId), message);
                const { chunks } = await chunkWithChunker(chunker, makeParams(header, null, requestId), message);
                should(Buffer.concat(chunks).toString("hex")).eql(Buffer.concat(expected).toString("hex"));
            }
        });
    });

    describe("a MessageBuilder reads the chunks back, real RSA", () => {
        for (const securityPolicy of policies) {
            for (const keySize of keySizes) {
                for (const securityMode of [MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt]) {
                    for (const async of [false, true]) {
                        const name = `${securityPolicy.split("#")[1]} ${keySize} ${MessageSecurityMode[securityMode]}${async ? " async" : ""}`;
                        it(`OPN-2 ${name}`, async () => {
                            const header = makeHeader(securityPolicy, keySize, keySize, true);
                            const security = realSecurity(securityPolicy, keySize, keySize, async);
                            const limit = maxBodySize(securityMode, makeParams(header, security, 1));
                            const messages = [makeRequest(32), makeRequest(limit), makeRequest(limit + 200)];

                            const messageBuilder = new MessageBuilder(
                                { getDerivedKey: () => null },
                                {
                                    name: "MessageBuilder",
                                    maxMessageSize: 1024 * 1024,
                                    maxChunkSize: chunkSize,
                                    maxChunkCount: 10,
                                    keyOperations: keyOperationsFromPrivateKey(
                                        makePrivateKeyFromPem(identity(keySize).privateKeyPem)
                                    )
                                }
                            );
                            messageBuilder.setSecurity(securityMode, securityPolicy);
                            const received: { message: OpenSecureChannelRequest; requestId: number }[] = [];
                            const errors: string[] = [];
                            // settles once every message is decoded or on the first error, whether the builder
                            // decrypts synchronously or not
                            const settled = new Promise<void>((resolve) => {
                                messageBuilder.on("message", (message, _msgType, _securityHeader, requestId) => {
                                    received.push({ message: message as OpenSecureChannelRequest, requestId });
                                    if (received.length === messages.length) resolve();
                                });
                                messageBuilder.on("error", (err) => {
                                    errors.push(err.message);
                                    resolve();
                                });
                            });

                            const chunker = new MessageChunker({ securityMode });
                            let requestId = 0;
                            for (const message of messages) {
                                requestId++;
                                const { statusCode, chunks } = await chunkWithChunker(
                                    chunker,
                                    makeParams(header, security, requestId),
                                    message
                                );
                                should(statusCode).eql(StatusCodes.Good);
                                for (const chunk of chunks) {
                                    await messageBuilder.feed(chunk);
                                }
                            }
                            await settled;
                            should(errors).eql([]);
                            should(received.length).eql(messages.length);
                            received.forEach(({ message, requestId }, index) => {
                                should(requestId).eql(index + 1);
                                should(message.clientNonce).eql(messages[index].clientNonce);
                            });
                            messageBuilder.dispose();
                        });
                    }
                }
            }
        }
    });

    it("OPN-3 an asynchronous signing failure rejects and sends nothing", async () => {
        const securityMode = MessageSecurityMode.SignAndEncrypt;
        const header = makeHeader(SecurityPolicy.Basic256Sha256, 2048, 2048, true);
        const security = deterministicSecurity(SecurityPolicy.Basic256Sha256, 2048, 2048, true);
        let calls = 0;
        const failing: SecureMessageData = {
            ...security,
            signBufferAsyncFunc: async () => {
                calls++;
                if (calls === 2) throw new Error("provider unavailable");
                return Buffer.alloc(256);
            }
        };
        const params = makeParams(header, failing, 1);
        const limit = maxBodySize(securityMode, params);
        const chunks: (Buffer | null)[] = [];
        await should(
            new MessageChunker({ securityMode }).chunkSecureMessageAsync("OPN", params, makeRequest(2 * limit), (chunk) =>
                chunks.push(chunk)
            )
        ).be.rejectedWith(/provider unavailable/);
        should(calls).eql(2);
        should(chunks).eql([]);
    });

    it("OPN-5 a message chunked while an OPN waits for its remote signature leaves after it, in sequence order", async () => {
        const securityMode = MessageSecurityMode.Sign;
        // OPN signed by a remote key, here without encryption so that its sequence number stays readable
        const opnHeader = makeHeader(SecurityPolicy.Basic256Sha256, 2048, 2048, false);
        const signature = deterministicSecurity(SecurityPolicy.Basic256Sha256, 2048, 2048, true);
        const opnParams = makeParams(opnHeader, { ...signature, plainBlockSize: 0, cipherBlockSize: 0 }, 1);
        const cryptoFactory = cryptoFactoryOf(SecurityPolicy.Basic256Sha256);
        const keys = computeDerivedKeys(cryptoFactory, randomBytes(32), randomBytes(32)).derivedServerKeys;
        if (!keys) throw new Error("no derived keys");
        const msgParams: ChunkMessageParameters = {
            channelId,
            securityHeader: new SymmetricAlgorithmSecurityHeader({ tokenId: 1 }),
            securityOptions: {
                channelId,
                chunkSize,
                requestId: 2,
                sequenceHeaderSize: 0,
                ...getOptionsForSymmetricSignAndEncrypt(securityMode, keys)
            }
        };
        const opnSequenceOffset = 12 + opnHeader.binaryStoreSize();
        const wire: string[] = [];
        const chunker = new MessageChunker({ securityMode });
        const opn = chunker.chunkSecureMessageAsync("OPN", opnParams, makeRequest(10), (chunk) =>
            wire.push(chunk ? `OPN ${chunk.readUInt32LE(opnSequenceOffset)}` : "OPN end")
        );
        // the OPN has its sequence number and waits for its signature: this MSG takes the next one
        const statusCode = chunker.chunkSecureMessage("MSG", msgParams, makeRequest(10), (chunk) =>
            wire.push(chunk ? `MSG ${chunk.readUInt32LE(16)}` : "MSG end")
        );
        should(statusCode).eql(StatusCodes.Good);
        should(wire).eql([]);
        should(await opn).eql(StatusCodes.Good);
        const first = Number(wire[0].split(" ")[1]);
        should(wire).eql([`OPN ${first}`, "OPN end", `MSG ${first + 1}`, "MSG end"]);
    });

    it("OPN-4 an asynchronous signature through chunkSecureMessage is refused, not sent", () => {
        const securityMode = MessageSecurityMode.SignAndEncrypt;
        const params = makeParams(
            makeHeader(SecurityPolicy.Basic256Sha256, 2048, 2048, true),
            deterministicSecurity(SecurityPolicy.Basic256Sha256, 2048, 2048, true),
            1
        );
        const chunks: (Buffer | null)[] = [];
        const statusCode = new MessageChunker({ securityMode }).chunkSecureMessage("OPN", params, makeRequest(10), (chunk) =>
            chunks.push(chunk)
        );
        should(statusCode).eql(StatusCodes.BadInternalError);
        should(chunks).eql([]);
    });
});
