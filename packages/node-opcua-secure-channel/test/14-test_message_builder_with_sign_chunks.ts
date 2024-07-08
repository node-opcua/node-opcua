import should from "should";

import chalk from "chalk";
import fs from "fs";
import { assert } from "node-opcua-assert";
import { make_debugLog } from "node-opcua-debug";
import { hexDump } from "node-opcua-debug";
import { MessageSecurityMode } from "node-opcua-service-secure-channel";
import { readPrivateRsaKey } from "node-opcua-crypto";
import {
    computeDerivedKeys,
    encryptBufferWithDerivedKeys,
    makeMessageChunkSignature,
    makeMessageChunkSignatureWithDerivedKeys,
    makeSHA1Thumbprint,
    publicEncrypt_long,
    readCertificate,
    DerivedKeys,
    readPrivateKey,
    RSA_PKCS1_OAEP_PADDING,
    PaddingAlgorithm
} from "node-opcua-crypto";
import { AsymmetricAlgorithmSecurityHeader, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { SecureMessageChunkManager, SecureMessageChunkManagerOptions, SequenceNumberGenerator } from "../source";
import { make_lorem_ipsum_buffer } from "node-opcua-test-helpers";
import { MessageBuilder, SecurityPolicy } from "../source";
import { TokenStack } from "../source/token_stack";
import { IDerivedKeyProvider } from "../dist/source";
import { getFixture } from "node-opcua-test-fixtures";
import { Mode } from "node-opcua-chunkmanager";

const debugLog = make_debugLog("TEST");
const private_key_filename = getFixture("certs/server_key_1024.pem");

function installFakeDecodeMessageBody(messageBuilder: any) {
    function fake_decodeMessageBody(this: MessageBuilder, message: Buffer) {
        this.emit("message" as any, message);
        return true;
    }
    assert(typeof messageBuilder._decodeMessageBody === "function");
    messageBuilder._decodeMessageBody = fake_decodeMessageBody;
}

const senderCertificate = readCertificate(getFixture("certs/client_cert_1024.pem"));
const senderPrivateKey = readPrivateKey(getFixture("certs/client_key_1024.pem"));

const receiverCertificate = readCertificate(getFixture("certs/server_cert_1024.pem"));
const receiverCertificateThumbprint = makeSHA1Thumbprint(receiverCertificate);
const receiverPublicKey = fs.readFileSync(getFixture("certs/server_public_key_1024.pub")).toString();

const sequenceNumberGenerator = new SequenceNumberGenerator();

export type ChunkVisitorFunc = (chunk: Buffer, isFinal: boolean) => void;

export function iterateOnSignedMessageChunks(data: Buffer, callback: ChunkVisitorFunc) {
    const params = {
        algorithm: "RSA-SHA1",
        privateKey: senderPrivateKey,
        signatureLength: 128
    };

    const channelId = 10;
    const options = {
        chunkSize: 2048,
        cipherBlockSize: 0,
        plainBlockSize: 0,
        requestId: 10,
        sequenceHeaderSize: 0,
        signBufferFunc: (chunk: Buffer) => makeMessageChunkSignature(chunk, params),
        signatureLength: 128
    };

    const securityHeader = new AsymmetricAlgorithmSecurityHeader({
        receiverCertificateThumbprint: null, // null === no encryption ...receiverCertificateThumbprint
        securityPolicyUri: SecurityPolicy.Basic256,
        senderCertificate
    });

    const mode = Mode.Sign;
    const msgChunkManager = new SecureMessageChunkManager(mode, "OPN", channelId, options, securityHeader, sequenceNumberGenerator);

    msgChunkManager.on("chunk", (chunk: Buffer, final: boolean) => callback(chunk, final));

    msgChunkManager.write(data, data.length);
    msgChunkManager.end();
}

export function iterateOnSignedAndEncryptedMessageChunks(buffer: Buffer, callback: ChunkVisitorFunc) {
    const params = {
        signatureLength: 128,
        algorithm: "RSA-SHA1",
        privateKey: senderPrivateKey
    };

    const options = {
        chunkSize: 2048,
        cipherBlockSize: 128,
        encryptBufferFunc: (chunk: Buffer) =>
            publicEncrypt_long(chunk, receiverPublicKey, 128, 11, PaddingAlgorithm.RSA_PKCS1_PADDING),
        plainBlockSize: 128 - 11,
        requestId: 10,
        sequenceHeaderSize: 0, // ??
        signBufferFunc: (chunk: Buffer) => makeMessageChunkSignature(chunk, params),
        signatureLength: 128
    };

    const securityHeader = new AsymmetricAlgorithmSecurityHeader({
        receiverCertificateThumbprint,
        securityPolicyUri: SecurityPolicy.Basic256,
        senderCertificate
    });

    const channelId = 10;
    const mode = Mode.SignAndEncrypt;
    const msgChunkManager = new SecureMessageChunkManager(mode, "OPN", channelId, options, securityHeader, sequenceNumberGenerator);
    msgChunkManager.on("chunk", (chunk: Buffer, final: boolean) => callback(chunk, final));
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}

const secret = Buffer.from("My Little Secret");
const seed = Buffer.from("My Little Seed");
const globalOptions = {
    signingKeyLength: 16,
    encryptingKeyLength: 16,
    encryptingBlockSize: 16,
    signatureLength: 20,
    algorithm: "aes-128-cbc"
};

const derivedKeys: DerivedKeys = computeDerivedKeys(secret, seed, globalOptions);

export function iterateOnSymmetricEncryptedChunk(buffer: Buffer, onChunkFunc: ChunkVisitorFunc) {
    const options: SecureMessageChunkManagerOptions = {
        chunkSize: 1024,
        encryptBufferFunc: (chunk: Buffer) => encryptBufferWithDerivedKeys(chunk, derivedKeys),
        plainBlockSize: derivedKeys.encryptingBlockSize,
        cipherBlockSize: derivedKeys.encryptingBlockSize,
        requestId: 10,
        signBufferFunc: (chunk: Buffer) => makeMessageChunkSignatureWithDerivedKeys(chunk, derivedKeys),
        signatureLength: derivedKeys.signatureLength,
        sequenceHeaderSize: 0
    };

    const securityHeader = new SymmetricAlgorithmSecurityHeader({
        tokenId: 10
    });

    const channelId = 10;
    const mode = Mode.SignAndEncrypt;
    const msgChunkManager = new SecureMessageChunkManager(mode, "MSG", channelId, options, securityHeader, sequenceNumberGenerator);
    msgChunkManager.on("chunk", (chunk, final) => onChunkFunc(chunk, final));
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}

const derivedKeyProvider: IDerivedKeyProvider = {
    getDerivedKey(tokenId: number) {
        return null;
    }
};

describe("MessageBuilder with SIGN support", function () {
    const data = make_lorem_ipsum_buffer();
    const someBuffer = Buffer.from(data, data.length);

    it("MS-1 should not emit an error event if chunks have valid signature", (done) => {
        const messageBuilder = new MessageBuilder(derivedKeyProvider, {
            name: "MessageBuilder",
            maxChunkCount: 10,
            maxMessageSize: someBuffer.length * 10,
            maxChunkSize: someBuffer.length + 1000,
            privateKey: readPrivateRsaKey(private_key_filename)
        });

        messageBuilder.setSecurity(MessageSecurityMode.Sign, SecurityPolicy.Basic256);

        installFakeDecodeMessageBody(messageBuilder);

        messageBuilder
            .on("full_message_body", (message) => {
                console.log(hexDump(message));
                done();
            })
            .on("message", (message) => {
                /** */
            })
            .on("error", (error) => {
                console.log("ERROR", error);
                done(error);
            });

        iterateOnSignedMessageChunks(someBuffer, (chunk, isFinal) => {
            messageBuilder.feed(chunk!.subarray(0, 20));
            messageBuilder.feed(chunk!.subarray(20));
        });
    });

    it("MS-2 should reconstruct a full message made of many signed chunks", (done) => {
        const options = {
            name: "MessageBuilder",
        };

        const messageBuilder = new MessageBuilder(derivedKeyProvider, options);
        messageBuilder.setSecurity(MessageSecurityMode.Sign, SecurityPolicy.Basic256);

        installFakeDecodeMessageBody(messageBuilder);

        messageBuilder
            .on("full_message_body", (message) => {
                debugLog(hexDump(message));
                message.toString().should.eql(someBuffer.toString());
            })
            .on("chunk", (chunk) => {
                debugLog(hexDump(chunk));
            })
            .on("message", (message) => {
                debugLog(message.toString());
                done();
            })
            .on("error", (err) => {
                done(new Error(" we are not expecting a error event in this case" + err));
            });

        iterateOnSignedMessageChunks(someBuffer, (chunk, isFinal) => {
            messageBuilder.feed(chunk!.subarray(0, 20));
            messageBuilder.feed(chunk!.subarray(20));
        });
    });
    it("MS-3 should emit an bad_signature event if chunk has been tempered", (done) => {
        const options = {
            name: "MessageBuilder",
        };

        const messageBuilder = new MessageBuilder(derivedKeyProvider, options);
        messageBuilder.setSecurity(MessageSecurityMode.Sign, SecurityPolicy.Basic256);

        installFakeDecodeMessageBody(messageBuilder);

        messageBuilder
            .on("full_message_body", (message) => {
                done(new Error("it should not emit a message event if a signature is invalid or missing"));
            })
            .on("message", (message) => {
                done(new Error("it should not emit a message event if a signature is invalid or missing"));
            })
            .on("error", (err) => {
                debugLog(err);
                debugLog(chalk.yellow("this chunk has a altered body ( signature verification failed)"));
                //xx debugLog(hexDump(chunk));
                done();
            });

        iterateOnSignedMessageChunks(someBuffer, (chunk, isFinal) => {
            // alter artificially the chunk
            // this will damage the chunk signature
            chunk!.write("####*** TEMPERED ***#####", 0x3a0);
            console.log(hexDump(chunk));
            messageBuilder.feed(chunk!.subarray(0, 20));
            messageBuilder.feed(chunk!.subarray(20));
        });
    });
});

describe("MessageBuilder with SIGN & ENCRYPT support (OPN) ", function () {
    const lorem_ipsum_buffer = make_lorem_ipsum_buffer();
    const tokenStack = new TokenStack(1);

    xit("MSE-1 should not emit an error event with valid SIGN & ENCRYPT chunks", (done) => {
        const options = {
            name: "MessageBuilder",
            privateKey: readPrivateRsaKey(private_key_filename)
        };

        const messageBuilder = new MessageBuilder(tokenStack.clientKeyProvider(), options);

        installFakeDecodeMessageBody(messageBuilder);

        messageBuilder
            .on("full_message_body", (message) => {
                message.toString().should.eql(lorem_ipsum_buffer.toString());
                done();
            })
            .on("message", (message) => {
                /** */
            })
            .on("error", (error) => {
                done(error);
            });

        iterateOnSignedAndEncryptedMessageChunks(lorem_ipsum_buffer, (chunk, isFinal) => {
            //xx console.log(hexDump(chunk));
            messageBuilder.feed(chunk!.subarray(0, 20));
            messageBuilder.feed(chunk!.subarray(20));
        });
    });
});

describe("MessageBuilder with SIGN & ENCRYPT support (MSG) ", function () {
    const lorem_ipsum_buffer = make_lorem_ipsum_buffer();

    it("MSE-2 should process a signed and encrypted message", (done) => {
        const myDerivedKeyProvider: IDerivedKeyProvider = {
            getDerivedKey(tokenId: number) {
                return derivedKeys;
            }
        };

        const messageBuilder = new MessageBuilder(myDerivedKeyProvider, {
            name: "MessageBuilder",
            maxMessageSize: 1000000,
            maxChunkSize: 2048,
            maxChunkCount: 5,
            privateKey: readPrivateRsaKey(private_key_filename)
            // securityMode: MessageSecurityMode.SignAndEncrypt
        });
        // simulate reception of OpenSecureChannelRequest with SignAndEncrypt/Basic256
        messageBuilder.setSecurity(MessageSecurityMode.SignAndEncrypt, SecurityPolicy.Basic256);

        installFakeDecodeMessageBody(messageBuilder);

        let _err;
        messageBuilder
            .on("full_message_body", (message) => {
                console.log(hexDump(message));
                message.toString().should.eql(lorem_ipsum_buffer.toString());
                done();
            })
            .on("message", (message) => {
                /** */
            })
            .on("error", (error) => {
                console.log("err ", error.message);
                done(error);
            });

        iterateOnSymmetricEncryptedChunk(lorem_ipsum_buffer, (chunk, isFinal) => {
            // chunk contains the encrypted chunk !
            messageBuilder.feed(chunk!);
        });
    });
});
