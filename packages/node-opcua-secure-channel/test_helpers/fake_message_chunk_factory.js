
var hexDump = require("node-opcua-debug").hexDump;

var SecureMessageChunkManager = require("../src/secure_message_chunk_manager").SecureMessageChunkManager;
var SequenceNumberGenerator = require("../src/sequence_number_generator").SequenceNumberGenerator;

var AsymmetricAlgorithmSecurityHeader = require("node-opcua-service-secure-channel").AsymmetricAlgorithmSecurityHeader;
var SymmetricAlgorithmSecurityHeader = require("node-opcua-service-secure-channel").SymmetricAlgorithmSecurityHeader;

var crypto_utils = require("node-opcua-crypto").crypto_utils;
var fs = require("fs");
var path = require("path");

var getFixture = require("node-opcua-test-fixtures").getFixture;

var senderCertificate = crypto_utils.readCertificate(getFixture("certs/client_cert_1024.pem"));
var senderPrivateKey = crypto_utils.readKeyPem(getFixture("certs/client_key_1024.pem"));

var receiverCertificate = crypto_utils.readCertificate(getFixture("certs/server_cert_1024.pem"));
var receiverCertificateThumbprint = crypto_utils.makeSHA1Thumbprint(receiverCertificate);

var receiverPublicKey = fs.readFileSync(getFixture("certs/server_public_key_1024.pub"));

var sequenceNumberGenerator = new SequenceNumberGenerator();

/**
 * @method iterate_on_signed_message_chunks
 * @param buffer
 * @param callback {Function}
 * @param callback.err  {Error}
 * @param callback.chunks  {Array<Buffer>}
 *
 */
function iterate_on_signed_message_chunks(buffer, callback) {

    var params = {signatureLength: 128, algorithm: "RSA-SHA1", privateKey: senderPrivateKey};

    var options = {
        requestId: 10,
        chunkSize: 2048,
        signatureLength: 128,
        signingFunc: function (chunk) {
            return crypto_utils.makeMessageChunkSignature(chunk, params);
        }
    };

    var securityHeader = new AsymmetricAlgorithmSecurityHeader({
        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
        senderCertificate: senderCertificate,
        receiverCertificateThumbprint: null // null === no encryption ...receiverCertificateThumbprint
    });

    var msgChunkManager = new SecureMessageChunkManager("OPN", options, securityHeader, sequenceNumberGenerator);

    msgChunkManager.on("chunk", function (chunk, final) {
        callback(null, chunk);
    });
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}
exports.iterate_on_signed_message_chunks = iterate_on_signed_message_chunks;

function iterate_on_signed_and_encrypted_message_chunks(buffer, callback) {

    var params = {signatureLength: 128, algorithm: "RSA-SHA1", privateKey: senderPrivateKey};

    var options = {
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

    var securityHeader = new AsymmetricAlgorithmSecurityHeader({
        securityPolicyUri: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
        senderCertificate: senderCertificate,
        receiverCertificateThumbprint: receiverCertificateThumbprint
    });

    var msgChunkManager = new SecureMessageChunkManager("OPN", options, securityHeader, sequenceNumberGenerator);
    msgChunkManager.on("chunk", function (chunk, final) {
        callback(null, chunk);
    });
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}
exports.iterate_on_signed_and_encrypted_message_chunks = iterate_on_signed_and_encrypted_message_chunks;


var secret = new Buffer("My Little Secret");
var seed = new Buffer("My Little Seed");
var options = {
    signingKeyLength: 16,
    encryptingKeyLength: 16,
    encryptingBlockSize: 16,
    signatureLength: 20,
    algorithm: "aes-128-cbc"
};
var derivedKeys = crypto_utils.computeDerivedKeys(secret, seed, options);
exports.derivedKeys = derivedKeys;

function iterate_on_symmetric_encrypted_chunk(buffer, callback) {

    var options = {
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

    var securityHeader = new SymmetricAlgorithmSecurityHeader({
        tokenId: 10
    });

    var msgChunkManager = new SecureMessageChunkManager("MSG", options, securityHeader, sequenceNumberGenerator);
    msgChunkManager.on("chunk", function (chunk, final) {
        callback(null, chunk);
    });
    msgChunkManager.write(buffer, buffer.length);
    msgChunkManager.end();
}
exports.iterate_on_symmetric_encrypted_chunk = iterate_on_symmetric_encrypted_chunk;
