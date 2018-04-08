const assert = require("node-opcua-assert").assert;
const fs = require("fs");
const crypto_utils = require("node-opcua-crypto").crypto_utils;

const getFixture = require("node-opcua-test-fixtures").getFixture;

function construct_makeMessageChunkSignatureForTest() {

    const privateKey = fs.readFileSync(getFixture("certs/server_key_1024.pem")).toString("ascii");

    return function (chunk) {
        const options = {
            algorithm: "RSA-SHA256",
            signatureLength: 128,
            privateKey: privateKey
        };
        const buf = crypto_utils.makeMessageChunkSignature(chunk, options); // Buffer
        assert(buf instanceof Buffer, "expecting a Buffer");
        return buf;
    };
}
exports.makeMessageChunkSignatureForTest = construct_makeMessageChunkSignatureForTest();


function construct_verifyMessageChunkSignatureForTest() {

    const publicKey = fs.readFileSync(getFixture("certs/server_public_key_1024.pub")).toString("ascii");

    return function (chunk) {
        assert(chunk instanceof Buffer);
        const options = {
            algorithm: "RSA-SHA256",
            signatureLength: 128,
            publicKey: publicKey
        };
        return crypto_utils.verifyChunkSignature(chunk, options);
    };

}
exports.verifyMessageChunkSignatureForTest = construct_verifyMessageChunkSignatureForTest();


