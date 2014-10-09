/**
 * @module opcua.miscellaneous
 * @class CryptoUtils
 *
 * @static
 */
var fs = require("fs");
var crypto = require("crypto");
var assert = require("better-assert");

function readCertificate(filename) {

    var private_key_pem = fs.readFileSync(filename);
    var private_key = private_key_pem.toString('ascii');
    var a = private_key.split("\n");
    var base64Str = "";
    for (var i = 1; i < a.length - 2; i += 1) {
        base64Str = base64Str + a[i];
    }
    return new Buffer(base64Str, "base64");
}
exports.readCertificate = readCertificate;


/**
 * @method makeMessageChunkSignature
 * @param chunk
 * @param options {Object}
 * @param options.signatureLength {Number}
 * @param options.algorithm {String}   for example "RSA-SHA256"
 * @param options.privateKey {Buffer}
 * @return {Buffer} - the signature
 */
function makeMessageChunkSignature(chunk, options) {

    assert(chunk instanceof Buffer);
    // signature length = 128 bytes
    var signer = crypto.createSign(options.algorithm);
    signer.update(chunk);
    var signature = signer.sign(options.privateKey, 'binary');
    assert(signature.length === options.signatureLength);
    return signature;
}

exports.makeMessageChunkSignature = makeMessageChunkSignature;

/**
 * @method verifyChunkSignature
 *
 *     var signer = {
 *           signatureLength : 128,
 *           algorithm : "RSA-SHA256",
 *           public_key: "qsdqsdqsd"
 *     };
 *
 * @param chunk {Buffer} The message chunk to verify.
 * @param options {Object}
 * @param options.signatureLength {Number}
 * @param options.algorithm {String} the algorithm.
 * @param options.publicKey {Buffer}
 * @return {*}
 */
function verifyChunkSignature(chunk,options) {

    assert( chunk instanceof Buffer);
    var signatureLength = options.signatureLength;

    var block_to_verify = chunk.slice(0,chunk.length-signatureLength );
    var signature       = chunk.slice(chunk.length-signatureLength);

    var verify = crypto.createVerify(options.algorithm);
    verify.update(block_to_verify);
    var signature_valid = verify.verify(options.publicKey, signature);

    return signature_valid;
}
exports.verifyChunkSignature = verifyChunkSignature;


function makeSHA1Thumbprint(buffer) {

    var digest = crypto.createHash('sha1').update(buffer).digest("binary");
    return new Buffer(digest,"binary");
}
exports.makeSHA1Thumbprint  = makeSHA1Thumbprint;



