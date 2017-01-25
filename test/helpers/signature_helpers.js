require("requirish")._(module);


var assert = require("assert");
var fs = require("fs");
import crypto_utils from "lib/misc/crypto_utils";
    
var path = require("path");

function construct_makeMessageChunkSignatureForTest() {

    var privateKey = fs.readFileSync(path.join(__dirname, '../fixtures/certs/server_key_1024.pem')).toString('ascii');

    return function (chunk) {
        var options = {
            algorithm: "RSA-SHA256",
            signatureLength: 128,
            privateKey: privateKey
        };
        var buf = crypto_utils.makeMessageChunkSignature(chunk, options); // Buffer
        assert(buf instanceof Buffer, "expecting a Buffer");
        return buf;
    };
}
exports.makeMessageChunkSignatureForTest = construct_makeMessageChunkSignatureForTest();


function construct_verifyMessageChunkSignatureForTest() {

    var publicKey = fs.readFileSync(path.join(__dirname, '../fixtures/certs/server_public_key_1024.pub')).toString('ascii');

    return function (chunk) {
        assert(chunk instanceof Buffer);
        var options = {
            algorithm: "RSA-SHA256",
            signatureLength: 128,
            publicKey: publicKey
        };
        return crypto_utils.verifyChunkSignature(chunk, options);
    };

}
exports.verifyMessageChunkSignatureForTest = construct_verifyMessageChunkSignatureForTest();


