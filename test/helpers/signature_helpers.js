

var assert = require("assert");
var fs = require("fs");

function construct_makeMessageChunkSignatureForTest() {

    var private_key_pem = fs.readFileSync('certificates/key.pem');
    var private_key = private_key_pem.toString('ascii');

    var makeMessageChunkSignature = require("../../lib/misc/crypto_utils").makeMessageChunkSignature;

    return function (chunk) {
        var options = {
            algorithm : "RSA-SHA256",
            signatureLength: 128,
            privateKey: private_key
        };
        return makeMessageChunkSignature(chunk,options); // Buffer
    };
}
exports.makeMessageChunkSignatureForTest = construct_makeMessageChunkSignatureForTest();


function construct_verifyMessageChunkSignatureForTest() {

    var publicKey = fs.readFileSync('certificates/public_key.pub');
    publicKey = publicKey.toString('ascii');

    var verify_chunk_signature = require("../../lib/misc/crypto_utils").verifyChunkSignature;

    return function(chunk) {
        assert(chunk instanceof Buffer);
        var options = {
            algorithm : "RSA-SHA256",
            signatureLength: 128,
            publicKey: publicKey
        };
        return verify_chunk_signature(chunk,options);
    };

}
exports.verifyMessageChunkSignatureForTest = construct_verifyMessageChunkSignatureForTest();


