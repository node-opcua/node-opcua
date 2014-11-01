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


var sshKeyToPEM = require('ssh-key-to-pem');

//xx var  __certificate_store = __dirname + "/helpers/";
var  __certificate_store = __dirname + "/../../certificates/";

exports.setCertificateStore = function(store) {
    var old_store = __certificate_store;
    __certificate_store = store;
    return old_store;
}

function read_sshkey_as_pem(filename) {

    if (filename.substr(0,1) !== '.' ) {
        filename = __certificate_store + filename;
    }
    var key = fs.readFileSync( filename,"ascii");
    key = sshKeyToPEM(key);
    return key;
}
exports.read_sshkey_as_pem = read_sshkey_as_pem;

 function read_private_rsa_key(filename) {
    if (filename.substr(0,1) !== '.') {
        filename = __certificate_store + filename;
    }
    var key = fs.readFileSync(  filename,"ascii");
    return key;
}
exports.read_private_rsa_key = read_private_rsa_key;

exports.read_public_rsa_key = function(filename)
{
    return read_private_rsa_key(filename);
};



//======================================================================================================================

function display_public_key_Encryption_missing_message() {
    console.warn("\n Warning : your version of node doesn't provide crypto.publicEncrypt yet ".yellow,process.version);
    console.warn("           This should be sorted out in node > 0.12".cyan);
    console.warn("           require('ursa') doesn't seem to be installed either or is not compatible".yellow);
}

// Basically when you =encrypt something using an RSA key (whether public or private), the encrypted value must
// be smaller than the key (due to the maths used to do the actual encryption). So if you have a 1024-bit key,
// in theory you could encrypt any 1023-bit value (or a 1024-bit value smaller than the key) with that key.
// However, the PKCS#1 standard, which OpenSSL uses, specifies a padding scheme (so you can encrypt smaller
// quantities without losing security), and that padding scheme takes a minimum of 11 bytes (it will be longer
// if the value you're encrypting is smaller). So the highest number of bits you can encrypt with a 1024-bit
// key is 936 bits because of this (unless you disable the padding by adding the OPENSSL_NO_PADDING flag,
// in which case you can go up to 1023-1024 bits). With a 2048-bit key it's 1960 bits instead.

var ursa = null;
try {
    ursa = require("ursa");
}
catch(err) {
    ursa = null;
}

// publicEncrypt and  privateDecrypt only work with
// small buffer that depends of the key size.
function publicEncrypt_native(buffer,public_key) {
    assert(buffer instanceof Buffer,"Expecting a buffer");
    return crypto.publicEncrypt(public_key,buffer);
}
function publicEncrypt_ursa(buffer,public_key) {
    assert(ursa);
    var crt = ursa.createPublicKey(public_key);
    buffer = crt.encrypt(buffer,undefined,undefined,ursa.RSA_PKCS1_PADDING);
    return buffer;
}

function privateDecrypt_native(buffer,private_key) {
    assert(buffer instanceof Buffer,"Expecting a buffer");
    return crypto.privateDecrypt(private_key,buffer);
}

function privateDecrypt_ursa(buffer,private_key) {
    assert(ursa);
    //xx console.log( " BUFF ER L =",buffer.length);
    var key = ursa.createPrivateKey(private_key);
    //xx assert(key.isPrivateKey());
    buffer = key.decrypt(buffer,undefined,undefined,ursa.RSA_PKCS1_PADDING);
    //xx buffer = key.decrypt(buffer);
    return buffer;
}

function publicEncrypt_long(buffer,key,block_size,padding) {

    var chunk_size = block_size - padding;
    var nbBlocks = Math.ceil(buffer.length / (chunk_size));

    var outputBuffer = new Buffer(nbBlocks * block_size);
    for (var i = 0; i < nbBlocks; i++) {
        var currentBlock  = buffer.slice(chunk_size*i,chunk_size*(i+1));
        var encrypted_chunk = publicEncrypt(currentBlock,key);
        assert(encrypted_chunk.length === block_size);
        encrypted_chunk.copy(outputBuffer,i*block_size);
    }
    return outputBuffer;
}

function privateDecrypt_long(buffer,key,block_size,padding) {

    var chunk_size = block_size - padding;
    var nbBlocks = Math.ceil(buffer.length / (block_size));

    var outputBuffer = new Buffer(nbBlocks * chunk_size);

    var total_length = 0;
    for (var i = 0; i < nbBlocks; i++) {
        var currentBlock  = buffer.slice(block_size*i,block_size*(i+1));
        var decrypted_buf = privateDecrypt(currentBlock,key);
        total_length+= decrypted_buf.length;
        decrypted_buf.copy(outputBuffer,i*chunk_size);
    }
    return outputBuffer.slice(0,total_length);

}

var publicEncrypt = null;
var privateDecrypt = null;
if (!ursa && !crypto.hasOwnProperty("publicEncrypt") ) {
    display_public_key_Encryption_missing_message();
} else {
    publicEncrypt =  crypto.hasOwnProperty("publicEncrypt") ?   publicEncrypt_native : publicEncrypt_ursa;
    privateDecrypt=  crypto.hasOwnProperty("publicEncrypt") ?   privateDecrypt_native : privateDecrypt_ursa;
}

exports.publicEncrypt = publicEncrypt;
exports.publicEncrypt_long = publicEncrypt_long;
exports.privateDecrypt = privateDecrypt;
exports.privateDecrypt_long = privateDecrypt_long;

/***
 * A very expensive way to determine the rsa key length ( i.e 2048bits or 1024bits)
 * @param key
 * @returns {*}
 */
exports.rsa_length = function(key) {
    var b = publicEncrypt(new Buffer(1),key);
    return b.length;
};
