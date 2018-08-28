import * as fs from "fs";
import {
    readCertificate,
    readKeyPem,
    makeSHA1Thumbprint,
    makeMessageChunkSignature,
    publicEncrypt_long,
    RSA_PKCS1_PADDING,
    computeDerivedKeys,
    makeMessageChunkSignatureWithDerivedKeys,
    encryptBufferWithDerivedKeys,
    DerivedKeys
} from "node-opcua-crypto";
import { AsymmetricAlgorithmSecurityHeader, SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { SecureMessageChunkManager, SequenceNumberGenerator } from "../src";

const getFixture = require("node-opcua-test-fixtures").getFixture;

const senderCertificate = readCertificate(getFixture("certs/client_cert_1024.pem"));
const senderPrivateKey = readKeyPem(getFixture("certs/client_key_1024.pem"));

const receiverCertificate =  readCertificate(getFixture("certs/server_cert_1024.pem"));
const receiverCertificateThumbprint = makeSHA1Thumbprint(receiverCertificate);

const receiverPublicKey = fs.readFileSync(getFixture("certs/server_public_key_1024.pub", "ascii")).toString();

const sequenceNumberGenerator = new SequenceNumberGenerator();

export type ChunkVisitorFunc = (err: Error | null, chunk?: Buffer) => void;


export function iterateOnSignedMessageChunks(buffer: Buffer, callback: ChunkVisitorFunc) {

    const params = {
        signatureLength: 128,
        algorithm: "RSA-SHA1",
        privateKey: senderPrivateKey
    };

    const options = {
        requestId: 10,
        chunkSize: 2048,
        signatureLength: 128,
        signBufferFunc: (chunk: Buffer) => makeMessageChunkSignature(chunk, params),
        sequenceHeaderSize: 0,
        plainBlockSize: 0,
        cipherBlockSize: 0,
    };

    const securityHeader = new AsymmetricAlgorithmSecurityHeader({
        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
        senderCertificate,
        receiverCertificateThumbprint: null // null === no encryption ...receiverCertificateThumbprint
    });

    const msgChunkManager = new SecureMessageChunkManager("OPN", options, securityHeader, sequenceNumberGenerator);

    msgChunkManager.on("chunk", (chunk: Buffer, final: boolean) => callback(null, chunk));
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}

export function iterateOnSignedAndEncryptedMessageChunks(buffer: Buffer, callback: ChunkVisitorFunc) {

    const params = {signatureLength: 128, algorithm: "RSA-SHA1", privateKey: senderPrivateKey};

    const options = {
        requestId: 10,
        chunkSize: 2048,
        signatureLength: 128,
        signBufferFunc: (chunk: Buffer) => makeMessageChunkSignature(chunk, params),
        plainBlockSize: 128 - 11,
        cipherBlockSize: 128,
        encryptBufferFunc: (chunk: Buffer) => publicEncrypt_long(chunk, receiverPublicKey, 128, 11, RSA_PKCS1_PADDING),
        sequenceHeaderSize: 0, // ??
    };

    const securityHeader = new AsymmetricAlgorithmSecurityHeader({
        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
        senderCertificate,
        receiverCertificateThumbprint
    });

    const msgChunkManager = new SecureMessageChunkManager("OPN", options, securityHeader, sequenceNumberGenerator);
    msgChunkManager.on("chunk", (chunk: Buffer, final: boolean) => callback(null, chunk));
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}


const secret = Buffer.from("My Little Secret");
const seed = Buffer.from("My Little Seed");
const options = {
    signingKeyLength: 16,
    encryptingKeyLength: 16,
    encryptingBlockSize: 16,
    signatureLength: 20,
    algorithm: "aes-128-cbc"
};

export const derivedKeys = computeDerivedKeys(secret, seed, options);

export function iterateOnSymmetricEncryptedChunk(buffer: Buffer, callback: ChunkVisitorFunc) {

    const options: any = {
        requestId: 10,
        chunkSize: 1024,
        signatureLength: 0,
        signBufferFunc: null,
        plainBlockSize: 0,
        encryptBufferFunc: null,
    };

    options.signatureLength = derivedKeys.signatureLength;
    options.signBufferFunc = (chunk: Buffer) => makeMessageChunkSignatureWithDerivedKeys(chunk, derivedKeys);

    options.plainBlockSize = derivedKeys.encryptingBlockSize;
    options.cipherBlockSize = derivedKeys.encryptingBlockSize;
    options.encryptBufferFunc = (chunk: Buffer) => encryptBufferWithDerivedKeys(chunk, derivedKeys);

    const securityHeader = new SymmetricAlgorithmSecurityHeader({
        tokenId: 10
    });

    const msgChunkManager = new SecureMessageChunkManager("MSG", options, securityHeader, sequenceNumberGenerator);
    msgChunkManager.on("chunk", (chunk, final) => callback(null, chunk));
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}
