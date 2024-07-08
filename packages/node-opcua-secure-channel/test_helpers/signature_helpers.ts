import fs from "fs";
import "should";
import { assert } from "node-opcua-assert";
import { makeMessageChunkSignature, readPrivateKey, verifyChunkSignature } from "node-opcua-crypto";
import { SymmetricAlgorithmSecurityHeader } from "node-opcua-service-secure-channel";
import { SecureMessageChunkManager, SecureMessageChunkManagerOptions, SequenceNumberGenerator } from "../source";

// tslint:disable:no-var-requires
const { getFixture } = require("node-opcua-test-fixtures");

function construct_makeMessageChunkSignatureForTest() {
    const privateKey = readPrivateKey(getFixture("certs/server_key_1024.pem"));

    return (chunk: Buffer) => {
        const options = {
            algorithm: "RSA-SHA256",
            privateKey,
            signatureLength: 128
        };
        const buf = makeMessageChunkSignature(chunk, options); // Buffer
        assert(buf instanceof Buffer, "expecting a Buffer");
        return buf;
    };
}
export const makeMessageChunkSignatureForTest = construct_makeMessageChunkSignatureForTest();

export function construct_verifyMessageChunkSignatureForTest() {
    const publicKey = fs.readFileSync(getFixture("certs/server_public_key_1024.pub")).toString("utf-8");
    return (chunk: Buffer) => {
        assert(chunk instanceof Buffer);
        const options = {
            algorithm: "RSA-SHA256",
            publicKey,
            signatureLength: 128
        };

        return verifyChunkSignature(chunk, options);
    };
}

export const verifyMessageChunkSignatureForTest = construct_verifyMessageChunkSignatureForTest();

