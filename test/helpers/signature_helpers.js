require("requirish")._(module);


var assert = require("assert");
var fs = require("fs");
var crypto_utils = require("lib/misc/crypto_utils");

function construct_makeMessageChunkSignatureForTest() {

    var privateKey = fs.readFileSync('certificates/key.pem').toString('ascii');

    return function (chunk) {
        var options = {
            algorithm : "RSA-SHA256",
            signatureLength: 128,
            privateKey: privateKey
        };
        var buf =  crypto_utils.makeMessageChunkSignature(chunk,options); // Buffer
        assert(buf instanceof Buffer,"expecting a Buffer");
        return buf;
    };
}
exports.makeMessageChunkSignatureForTest = construct_makeMessageChunkSignatureForTest();


function construct_verifyMessageChunkSignatureForTest() {

    var publicKey = fs.readFileSync('certificates/public_key.pub').toString('ascii');

    return function(chunk) {
        assert(chunk instanceof Buffer);
        var options = {
            algorithm : "RSA-SHA256",
            signatureLength: 128,
            publicKey: publicKey
        };
        return crypto_utils.verifyChunkSignature(chunk,options);
    };

}
exports.verifyMessageChunkSignatureForTest = construct_verifyMessageChunkSignatureForTest();


