"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);
var Enum = require("lib/misc/enum");
var assert = require("better-assert");
var _ = require("underscore");

/**
 * @class SecurityPolicy
 * @static
 *
 * OPCUA Spec Release 1.02  page 15    OPC Unified Architecture, Part 7
 *
 * @property Basic128Rsa15    Security Basic 128Rsa15
 * -----------------------
 *  A suite of algorithms that uses RSA15 as
 *  Key-Wrap-algorithm and 128-Bit for  encryption algorithms.
 *    -> SymmetricSignatureAlgorithm   -   HmacSha1 -(http://www.w3.org/2000/09/xmldsig#hmac-sha1).
 *    -> SymmetricEncryptionAlgorithm  -     Aes128 -(http://www.w3.org/2001/04/xmlenc#aes128-cbc).
 *    -> AsymmetricSignatureAlgorithm  -    RsaSha1 -(http://www.w3.org/2000/09/xmldsig#rsa-sha1).
 *    -> AsymmetricKeyWrapAlgorithm    -    KwRsa15 -(http://www.w3.org/2001/04/xmlenc#rsa-1_5).
 *    -> AsymmetricEncryptionAlgorithm -      Rsa15 -(http://www.w3.org/2001/04/xmlenc#rsa-1_5).
 *    -> KeyDerivationAlgorithm        -      PSha1 -(http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha1).
 *    -> DerivedSignatureKeyLength     -  128
 *    -> MinAsymmetricKeyLength        - 1024
 *    -> MaxAsymmetricKeyLength        - 2048
 *    -> CertificateSignatureAlgorithm - Sha1
 *
 * @property Basic256 Security Basic 256:
 * -------------------
 * A suite of algorithms that are for 256-Bit encryption, algorithms include:
 *    -> SymmetricSignatureAlgorithm   - HmacSha1 -(http://www.w3.org/2000/09/xmldsig#hmac-sha1).
 *    -> SymmetricEncryptionAlgorithm  -   Aes256 -(http://www.w3.org/2001/04/xmlenc#aes256-cbc).
 *    -> AsymmetricSignatureAlgorithm  -  RsaSha1 -(http://www.w3.org/2000/09/xmldsig#rsa-sha1).
 *    -> AsymmetricKeyWrapAlgorithm    - KwRsaOaep-(http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p).
 *    -> AsymmetricEncryptionAlgorithm -  RsaOaep -(http://www.w3.org/2001/04/xmlenc#rsa-oaep).
 *    -> KeyDerivationAlgorithm        -    PSha1 -(http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha1).
 *    -> DerivedSignatureKeyLength     -  192.
 *    -> MinAsymmetricKeyLength        - 1024
 *    -> MaxAsymmetricKeyLength        - 2048
 *    -> CertificateSignatureAlgorithm - Sha1
 *
 * @property Basic256 Security Basic 256 Sha256
 * --------------------------------------------
 * A suite of algorithms that are for 256-Bit encryption, algorithms include.
 *   -> SymmetricSignatureAlgorithm   - Hmac_Sha256 -(http://www.w3.org/2000/09/xmldsig#hmac-sha256).
 *   -> SymmetricEncryptionAlgorithm  -  Aes256_CBC -(http://www.w3.org/2001/04/xmlenc#aes256-cbc).
 *   -> AsymmetricSignatureAlgorithm  -  Rsa_Sha256 -(http://www.w3.org/2000/09/xmldsig#rsa-sha256).
 *   -> AsymmetricKeyWrapAlgorithm    -   KwRsaOaep -(http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p).
 *   -> AsymmetricEncryptionAlgorithm -    Rsa_Oaep -(http://www.w3.org/2001/04/xmlenc#rsa-oaep).
 *   -> KeyDerivationAlgorithm        -     PSHA256 -(http://docs.oasis-open.org/ws-sx/ws-secureconversation/200512/dk/p_sha256).
 *   -> DerivedSignatureKeyLength     - 256
 *   -> MinAsymmetricKeyLength        - 2048
 *   -> MaxAsymmetricKeyLength        - 4096
 *   -> CertificateSignatureAlgorithm - Sha256
 *
 *  Support for this security profile may require support for a second application instance certificate, with a larger
 *  keysize. Applications shall support multiple Application Instance Certificates if required by supported Security
 *  Polices and use the certificate that is required for a given security endpoint.
 *
 *
 */
var SecurityPolicy = new Enum({
    Invalid: "invalid",
    None: "http://opcfoundation.org/UA/SecurityPolicy#None",
    Basic128: "http://opcfoundation.org/UA/SecurityPolicy#Basic128",
    Basic128Rsa15: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
    Basic192: "http://opcfoundation.org/UA/SecurityPolicy#Basic192",
    Basic192Rsa15: "http://opcfoundation.org/UA/SecurityPolicy#Basic192Rsa15",
    Basic256: "http://opcfoundation.org/UA/SecurityPolicy#Basic256",
    Basic256Rsa15: "http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15",
    Basic256Sha256: "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256"
});

exports.fromURI = function (uri) {
    // istanbul ignore next
    if (typeof uri !== "string") {
        return SecurityPolicy.Invalid;
    }
    var a = uri.split("#");
    // istanbul ignore next
    if (a.length < 2) {
        return SecurityPolicy.Invalid;
    }
    var v = SecurityPolicy[a[1]];
    return v || SecurityPolicy.Invalid;
};

exports.toURI = function (value) {
    var securityPolicy = SecurityPolicy.get(value) || SecurityPolicy.Invalid;
    if (securityPolicy === SecurityPolicy.Invalid) {
        throw new Error("trying to convert an invalid Security Policy into a URI: " + value);
    }
    return securityPolicy.value;
};

exports.SecurityPolicy = SecurityPolicy;


var crypto_utils = require("lib/misc/crypto_utils");


// --------------------
function RSAPKCS1V15_Decrypt(buffer, privateKey) {
    var block_size = crypto_utils.rsa_length(privateKey);
    return crypto_utils.privateDecrypt_long(buffer, privateKey, block_size, crypto_utils.RSA_PKCS1_PADDING);
}
function RSAOAEP_Decrypt(buffer, privateKey) {
    var block_size = crypto_utils.rsa_length(privateKey);
    return crypto_utils.privateDecrypt_long(buffer, privateKey, block_size, crypto_utils.RSA_PKCS1_OAEP_PADDING);
}
// --------------------

function asymmetricVerifyChunk(chunk, certificate) {

    var crypto_factory = this;
    assert(chunk instanceof Buffer);
    assert(certificate instanceof Buffer);
    // let's get the signatureLength by checking the size
    // of the certificate's public key
    var cert = crypto_utils.exploreCertificate(certificate);

    var signatureLength = cert.publicKeyLength; // 1024 bits = 128Bytes or 2048=256Bytes
    var block_to_verify = chunk.slice(0, chunk.length - signatureLength);
    var signature = chunk.slice(chunk.length - signatureLength);
    return crypto_factory.asymmetricVerify(block_to_verify, signature, certificate);

}

function RSAPKCS1V15SHA1_Verify(buffer, signature, certificate) {
    assert(certificate instanceof Buffer);
    assert(signature instanceof Buffer);
    var options = {
        algorithm: "RSA-SHA1",
        publicKey: crypto_utils.toPem(certificate, "CERTIFICATE")
    };
    return crypto_utils.verifyMessageChunkSignature(buffer, signature, options);
}
var RSAPKCS1OAEPSHA1_Verify = RSAPKCS1V15SHA1_Verify;

function RSAPKCS1OAEPSHA256_Verify(buffer, signature, certificate) {
    var options = {
        algorithm: "RSA-SHA256",
        publicKey: crypto_utils.toPem(certificate, "CERTIFICATE")
    };
    return crypto_utils.verifyMessageChunkSignature(buffer, signature, options);
}


function RSAPKCS1V15SHA1_Sign(buffer, privateKey) {

    if (privateKey instanceof Buffer) {
        privateKey = crypto_utils.toPem(privateKey, "RSA PRIVATE KEY");
    }
    var params = {
        signatureLength: crypto_utils.rsa_length(privateKey),
        algorithm: "RSA-SHA1",
        privateKey: privateKey
    };
    return crypto_utils.makeMessageChunkSignature(buffer, params);
}

var RSAPKCS1OAEPSHA1_Sign = RSAPKCS1V15SHA1_Sign;

function RSAPKCS1V15_Encrypt(buffer, publicKey) {

    var key_length = crypto_utils.rsa_length(publicKey);
    return crypto_utils.publicEncrypt_long(buffer, publicKey, key_length, 11, crypto_utils.RSA_PKCS1_PADDING);
}

function RSAOAEP_Encrypt(buffer, publicKey) {
    var key_length = crypto_utils.rsa_length(publicKey);
    return crypto_utils.publicEncrypt_long(buffer, publicKey, key_length, 42, crypto_utils.RSA_PKCS1_OAEP_PADDING);
}


function HMAC_SHA1_Sign(buffer) {

}
function HMAC_SHA1_Verify(buffer) {

}

function AES_128_CBC_Encrypt() {
}
function AES_128_CBC_Decrypt() {
}
function AES_256_CBC_Encrypt() {
}
function AES_256_CBC_Decrypt() {
}

function compute_derived_keys(serverNonce, clientNonce) {

    var self = this;

    // calculate derived keys
    var derivedKeys = {
        derivedClientKeys: null,
        derivedServerKeys: null,
        algorithm: null
    };

    if (clientNonce && serverNonce) {
        var options = {
            signingKeyLength: self.derivedSignatureKeyLength,
            encryptingKeyLength: self.derivedEncryptionKeyLength,
            encryptingBlockSize: self.encryptingBlockSize,
            signatureLength: self.signatureLength,
            algorithm: self.symmetricEncryptionAlgorithm
        };
        derivedKeys.derivedClientKeys = crypto_utils.computeDerivedKeys(serverNonce, clientNonce, options);
        derivedKeys.derivedServerKeys = crypto_utils.computeDerivedKeys(clientNonce, serverNonce, options);
    }
    return derivedKeys;
}


exports.compute_derived_keys = compute_derived_keys;

var _Basic128Rsa15 = {
    securityPolicy: SecurityPolicy.Basic128Rsa15,

    symmetricKeyLength: 16,
    derivedEncryptionKeyLength: 16,
    derivedSignatureKeyLength: 16,
    encryptingBlockSize: 16,
    signatureLength: 20,

    minimumAsymmetricKeyLength: 128,
    maximumAsymmetricKeyLength: 512,

    /* symmetric signature algorithm */
    symmetricSign: HMAC_SHA1_Sign,
    symmetricVerify: HMAC_SHA1_Verify,

    /* symmetric encryption algorithm */
    symmetricEncrypt: AES_128_CBC_Encrypt,
    symmetricDecrypt: AES_128_CBC_Decrypt,

    /* asymmetric signature algorithm */
    asymmetricVerifyChunk: asymmetricVerifyChunk,
    asymmetricSign: RSAPKCS1V15SHA1_Sign,
    asymmetricVerify: RSAPKCS1V15SHA1_Verify,
    asymmetricSignatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",

    /* asymmetric encryption algorithm */
    asymmetricEncrypt: RSAPKCS1V15_Encrypt,
    asymmetricDecrypt: RSAPKCS1V15_Decrypt,
    asymmetricEncryptionAlgorithm: "http://www.w3.org/2001/04/xmlenc#rsa-1_5",

    blockPaddingSize: 11,

    symmetricEncryptionAlgorithm: "aes-128-cbc",
    compute_derived_keys: compute_derived_keys

};

var _Basic256 = {
    securityPolicy: SecurityPolicy.Basic256,
    symmetricKeyLength: 32,
    derivedEncryptionKeyLength: 32,
    derivedSignatureKeyLength: 24,
    encryptingBlockSize: 16,
    signatureLength: 20,

    minimumAsymmetricKeyLength: 128,
    maximumAsymmetricKeyLength: 512,

    /* symmetric signature algorithm */
    symmetricSign: HMAC_SHA1_Sign,
    symmetricVerify: HMAC_SHA1_Verify,

    /* symmetric encryption algorithm */
    symmetricEncrypt: AES_256_CBC_Encrypt,
    symmetricDecrypt: AES_256_CBC_Decrypt,

    asymmetricVerifyChunk: asymmetricVerifyChunk,
    asymmetricSign: RSAPKCS1OAEPSHA1_Sign,
    asymmetricVerify: RSAPKCS1OAEPSHA1_Verify,
    asymmetricSignatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",

    /* asymmetric encryption algorithm */
    asymmetricEncrypt: RSAOAEP_Encrypt,
    asymmetricDecrypt: RSAOAEP_Decrypt,
    asymmetricEncryptionAlgorithm: "http://www.w3.org/2001/04/xmlenc#rsa-oaep",

    blockPaddingSize: 42,

    // "aes-256-cbc"
    symmetricEncryptionAlgorithm: "aes-256-cbc",
    compute_derived_keys: compute_derived_keys
};


function getCryptoFactory(securityPolicy) {

    assert(typeof securityPolicy.key === "string");

    switch (securityPolicy.key) {
        case SecurityPolicy.Basic128Rsa15.key:
            return _Basic128Rsa15;
        case SecurityPolicy.Basic256.key:
            return _Basic256;
        default:
            return null;
    }
}
exports.getCryptoFactory = getCryptoFactory;

var MessageSecurityMode = require("lib/datamodel/structures").MessageSecurityMode;
var SignatureData = require("lib/datamodel/structures").SignatureData;

function computeSignature(senderCertificate, senderNonce, receiverPrivatekey, securityPolicy) {

    if (!senderNonce || !senderCertificate) {
        return null;
    }

    var crypto_factory = getCryptoFactory(securityPolicy);
    if (!crypto_factory) {
        return null;
    }
    // This parameter is calculated by appending the clientNonce to the clientCertificate
    var buffer = Buffer.concat([senderCertificate, senderNonce]);

    // ... and signing the resulting sequence of bytes.
    var signature = crypto_factory.asymmetricSign(buffer, receiverPrivatekey);

    return new SignatureData({
        // This is a signature generated with the private key associated with a Certificate
        signature: signature,
        // A string containing the URI of the algorithm.
        // The URI string values are defined as part of the security profiles specified in Part 7.
        // (The SignatureAlgorithm shall be the AsymmetricSignatureAlgorithm specified in the
        // SecurityPolicy for the Endpoint)
        algorithm: crypto_factory.asymmetricSignatureAlgorithm // "http://www.w3.org/2000/09/xmldsig#rsa-sha1"
    });
}

exports.computeSignature = computeSignature;

function verifySignature(receiverCertificate, receiverNonce, signature, senderCertificate, securityPolicy) {

    if (securityPolicy === SecurityPolicy.None) {
        return true;
    }
    var crypto_factory = getCryptoFactory(securityPolicy);
    if (!crypto_factory) {
        return false;
    }
    assert(receiverNonce instanceof  Buffer);
    assert(receiverCertificate instanceof  Buffer);
    assert(signature instanceof SignatureData);

    assert(senderCertificate instanceof Buffer);

    if (!(signature.signature instanceof Buffer)) {
        // no signature provided
        return false;
    }

    assert(signature.signature instanceof Buffer);
    // This parameter is calculated by appending the clientNonce to the clientCertificate
    var buffer = Buffer.concat([receiverCertificate, receiverNonce]);

    return crypto_factory.asymmetricVerify(buffer, signature.signature, senderCertificate);
}


exports.verifySignature = verifySignature;

function getOptionsForSymmetricSignAndEncrypt(securityMode, derivedKeys) {
    assert(derivedKeys.hasOwnProperty("signatureLength"));
    assert(securityMode !== MessageSecurityMode.NONE && securityMode !== MessageSecurityMode.INVALID);

    var options = {
        signatureLength: derivedKeys.signatureLength,
        signingFunc: function (chunk) {
            return crypto_utils.makeMessageChunkSignatureWithDerivedKeys(chunk, derivedKeys);
        }
    };
    if (securityMode === MessageSecurityMode.SIGNANDENCRYPT) {

        options = _.extend(options, {
            plainBlockSize: derivedKeys.encryptingBlockSize,
            cipherBlockSize: derivedKeys.encryptingBlockSize,
            encrypt_buffer: function (chunk) {
                return crypto_utils.encryptBufferWithDerivedKeys(chunk, derivedKeys);
            }
        });
    }
    return options;
}
exports.getOptionsForSymmetricSignAndEncrypt = getOptionsForSymmetricSignAndEncrypt;
