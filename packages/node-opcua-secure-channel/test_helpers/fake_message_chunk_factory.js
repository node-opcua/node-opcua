
const hexDump = require("node-opcua-debug").hexDump;

const SecureMessageChunkManager = require("../src/secure_message_chunk_manager").SecureMessageChunkManager;
const SequenceNumberGenerator = require("../src/sequence_number_generator").SequenceNumberGenerator;

const AsymmetricAlgorithmSecurityHeader = require("node-opcua-service-secure-channel").AsymmetricAlgorithmSecurityHeader;
const SymmetricAlgorithmSecurityHeader = require("node-opcua-service-secure-channel").SymmetricAlgorithmSecurityHeader;

const crypto_utils = require("node-opcua-crypto").crypto_utils;
const fs = require("fs");
const path = require("path");

const getFixture = require("node-opcua-test-fixtures").getFixture;

const senderCertificate = crypto_utils.readCertificate(getFixture("certs/client_cert_1024.pem"));
const senderPrivateKey = crypto_utils.readKeyPem(getFixture("certs/client_key_1024.pem"));

const receiverCertificate = crypto_utils.readCertificate(getFixture("certs/server_cert_1024.pem"));
const receiverCertificateThumbprint = crypto_utils.makeSHA1Thumbprint(receiverCertificate);

const receiverPublicKey = fs.readFileSync(getFixture("certs/server_public_key_1024.pub"));

const sequenceNumberGenerator = new SequenceNumberGenerator();

/**
 * @method iterate_on_signed_message_chunks
 * @param buffer
 * @param callback {Function}
 * @param callback.err  {Error}
 * @param callback.chunks  {Array<Buffer>}
 *
 */
function iterate_on_signed_message_chunks(buffer, callback) {

    const params = {signatureLength: 128, algorithm: "RSA-SHA1", privateKey: senderPrivateKey};

    const options = {
        requestId: 10,
        chunkSize: 2048,
        signatureLength: 128,
        signingFunc: function (chunk) {
            return crypto_utils.makeMessageChunkSignature(chunk, params);
        }
    };

    const securityHeader = new AsymmetricAlgorithmSecurityHeader({
        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
        senderCertificate: senderCertificate,
        receiverCertificateThumbprint: null // null === no encryption ...receiverCertificateThumbprint
    });

    const msgChunkManager = new SecureMessageChunkManager("OPN", options, securityHeader, sequenceNumberGenerator);

    msgChunkManager.on("chunk", function (chunk, final) {
        callback(null, chunk);
    });
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}
exports.iterate_on_signed_message_chunks = iterate_on_signed_message_chunks;

function iterate_on_signed_and_encrypted_message_chunks(buffer, callback) {

    const params = {signatureLength: 128, algorithm: "RSA-SHA1", privateKey: senderPrivateKey};

    const options = {
        requestId: 10,
        chunkSize: 2048,
        signatureLength: 128,
        signingFunc: function (chunk) {
            return crypto_utils.makeMessageChunkSignature(chunk, params);
        },

        plainBlockSize: 128 - 11,
        cipherBlockSize: 128,
        encrypt_buffer: function (chunk) {
            return crypto_utils.publicEncrypt_long(chunk, receiverPublicKey, 128, 11);
        }
    };

    const securityHeader = new AsymmetricAlgorithmSecurityHeader({
        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
        senderCertificate: senderCertificate,
        receiverCertificateThumbprint: receiverCertificateThumbprint
    });

    const msgChunkManager = new SecureMessageChunkManager("OPN", options, securityHeader, sequenceNumberGenerator);
    msgChunkManager.on("chunk", function (chunk, final) {
        callback(null, chunk);
    });
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}
exports.iterate_on_signed_and_encrypted_message_chunks = iterate_on_signed_and_encrypted_message_chunks;


const secret = new Buffer("My Little Secret");
const seed = new Buffer("My Little Seed");
const options = {
    signingKeyLength: 16,
    encryptingKeyLength: 16,
    encryptingBlockSize: 16,
    signatureLength: 20,
    algorithm: "aes-128-cbc"
};
const derivedKeys = crypto_utils.computeDerivedKeys(secret, seed, options);
exports.derivedKeys = derivedKeys;

function iterate_on_symmetric_encrypted_chunk(buffer, callback) {

    const options = {
        requestId: 10,
        chunkSize: 1024
    };

    options.signatureLength = derivedKeys.signatureLength;
    options.signingFunc = function (chunk) {
        return crypto_utils.makeMessageChunkSignatureWithDerivedKeys(chunk, derivedKeys);
    };
    options.plainBlockSize = derivedKeys.encryptingBlockSize;
    options.cipherBlockSize = derivedKeys.encryptingBlockSize;
    options.encrypt_buffer = function (chunk) {
        return crypto_utils.encryptBufferWithDerivedKeys(chunk, derivedKeys);
    };

    const securityHeader = new SymmetricAlgorithmSecurityHeader({
        tokenId: 10
    });

    const msgChunkManager = new SecureMessageChunkManager("MSG", options, securityHeader, sequenceNumberGenerator);
    msgChunkManager.on("chunk", function (chunk, final) {
        callback(null, chunk);
    });
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}
exports.iterate_on_symmetric_encrypted_chunk = iterate_on_symmetric_encrypted_chunk;
