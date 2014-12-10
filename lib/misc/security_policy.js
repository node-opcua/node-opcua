"use strict";
/**
 * @module opcua.miscellaneous
 */
var Enum = require("enum");
var assert = require("better-assert");
var _ = require("underscore");

/**
 * OPCUA Spec Release 1.02  page 15    OPC Unified Architecture, Part 7
 *
 * Security Basic 128Rsa15
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
 * Security Basic 256:
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
 * Security Basic 256 Sha256
 * -------------------------
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
 * @type {Enum}
 */
var SecurityPolicy = new Enum({
    Invalid:       "invalid",
    None:          "http://opcfoundation.org/UA/SecurityPolicy#None",
    Basic128:      "http://opcfoundation.org/UA/SecurityPolicy#Basic128",
    Basic128Rsa15: "http://opcfoundation.org/UA/SecurityPolicy#Basic128Rsa15",
    Basic192:      "http://opcfoundation.org/UA/SecurityPolicy#Basic192",
    Basic192Rsa15: "http://opcfoundation.org/UA/SecurityPolicy#Basic192Rsa15",
    Basic256:      "http://opcfoundation.org/UA/SecurityPolicy#Basic256",
    Basic256Rsa15: "http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15",
    Basic256Sha256:"http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256"
});

SecurityPolicy.fromURI = function(uri) {
    var a = uri.split("#");
    var v = this[a[1]];
    return v || SecurityPolicy.Invalid;
};

SecurityPolicy.toURI = function(value) {
    var securityPolicy = SecurityPolicy.get(value) || SecurityPolicy.Invalid;
    if (securityPolicy === SecurityPolicy.Invalid) {
        throw new Error("trying to convert an invalid Security Policy into a URI: "+value);
    }
    return securityPolicy.value;
};

exports.SecurityPolicy =  SecurityPolicy;


var crypto_utils = require("./crypto_utils");


// --------------------
function RSAPKCS1V15_Decrypt(buffer,privateKey)
{
    var block_size = crypto_utils.rsa_length(privateKey);
    return crypto_utils.privateDecrypt_long(buffer,privateKey,block_size,crypto_utils.RSA_PKCS1_PADDING);
}
function RSAOAEP_Decrypt(buffer,privateKey)
{
    var block_size = crypto_utils.rsa_length(privateKey);
    return crypto_utils.privateDecrypt_long(buffer,privateKey,block_size,crypto_utils.RSA_PKCS1_OAEP_PADDING);
}
// --------------------


function RSAPKCS1V15SHA1_Verify(buffer,certificate) {

    var options = {
        algorithm : "RSA-SHA1",
        publicKey: crypto_utils.toPem(certificate,"CERTIFICATE")
    };
    return crypto_utils.verifyChunkSignature(buffer,options);
}
function RSAPKCS1OAEPSHA1_Verify(buffer,certificate) {
    var options = {
        algorithm: "RSA-SHA1",
        publicKey: crypto_utils.toPem(certificate, "CERTIFICATE")
    };
    return crypto_utils.verifyChunkSignature(buffer, options);
}

function RSAPKCS1OAEPSHA256_Verify(buffer,certificate) {
    var options = {
        algorithm : "RSA-SHA256",
        publicKey: crypto_utils.toPem(certificate,"CERTIFICATE")
    };
    return crypto_utils.verifyChunkSignature(buffer,options);
}


function RSAPKCS1V15SHA1_Sign(buffer,privateKey) {

    var params = {
        signatureLength: crypto_utils.rsa_length(privateKey),
        algorithm: "RSA-SHA1",
        privateKey: privateKey
    };
    return crypto_utils.makeMessageChunkSignature(buffer,params);

}
function RSAPKCS1OAEPSHA1_Sign(buffer,privateKey) {
    var params = {
        signatureLength: crypto_utils.rsa_length(privateKey),
        algorithm: "RSA-SHA1",
        privateKey: privateKey
    };
    return crypto_utils.makeMessageChunkSignature(buffer,params);
}

function RSAPKCS1V15_Encrypt(buffer,publicKey)
{
    var key_length=crypto_utils.rsa_length(publicKey);
    return crypto_utils.publicEncrypt_long(buffer, publicKey,key_length,11,crypto_utils.RSA_PKCS1_PADDING);
}

function RSAOAEP_Encrypt(buffer,publicKey)
{
    var key_length=crypto_utils.rsa_length(publicKey);
    return crypto_utils.publicEncrypt_long(buffer, publicKey,key_length,42,crypto_utils.RSA_PKCS1_OAEP_PADDING);
}



function HMAC_SHA1_Sign(buffer) {

}
function HMAC_SHA1_Verify(buffer) {

}

function AES_128_CBC_Encrypt() {}
function AES_128_CBC_Decrypt() {}
function AES_256_CBC_Encrypt() {}
function AES_256_CBC_Decrypt() {}

function compute_derived_keys(serverNonce,clientNonce) {

    var self = this;

    // calculate derived keys
    var derivedKeys = {
        derivedClientKeys: null,
        derivedServerKeys: null,
        algorithm: null
    };

    if (clientNonce && serverNonce) {
        var options = {
            signingKeyLength:    self.derivedSignatureKeyLength,
            encryptingKeyLength: self.derivedEncryptionKeyLength,
            encryptingBlockSize: self.encryptingBlockSize,
            signatureLength:     self.signatureLength,
            algorithm:           self.symmetricEncryptionAlgorithm
        };
        derivedKeys.derivedClientKeys = crypto_utils.computeDerivedKeys(serverNonce,clientNonce,options);
        derivedKeys.derivedServerKeys = crypto_utils.computeDerivedKeys(clientNonce,serverNonce,options);
    }
    return derivedKeys;
}

SecurityPolicy.compute_derived_keys = compute_derived_keys;

function getCryptoFactory(securityPolicy) {

    var data = {};
    data.securityPolicy = securityPolicy;

    switch(securityPolicy.key) {


        case SecurityPolicy.Basic128Rsa15.key:

            data.symmetricKeyLength         = 16;
            data.derivedEncryptionKeyLength = 16;
            data.derivedSignatureKeyLength  = 16;
            data.encryptingBlockSize        = 16;
            data.signatureLength            = 20;

            data.minimumAsymmetricKeyLength = 128;
            data.maximumAsymmetricKeyLength = 512;

            /* symmetric signature algorithm */
            data.symmetricSign              = HMAC_SHA1_Sign;
            data.symmetricVerify            = HMAC_SHA1_Verify;

            /* symmetric encryption algorithm */
            data.symmetricEncrypt           = AES_128_CBC_Encrypt;
            data.symmetricDecrypt           = AES_128_CBC_Decrypt;

            /* asymmetric signature algorithm */
            data.asymmetricSign             = RSAPKCS1V15SHA1_Sign;
            data.asymmetricVerify           = RSAPKCS1V15SHA1_Verify;
            data.assym_signatureLength            = 128; // or 256 depending on cert

            /* asymmetric encryption algorithm */
            data.asymmetricEncrypt          = RSAPKCS1V15_Encrypt;
            data.asymmetricDecrypt          = RSAPKCS1V15_Decrypt;

            data.blockPaddingSize = 11;
            //
            data.symmetricEncryptionAlgorithm = "aes-128-cbc";
            data.compute_derived_keys       = compute_derived_keys;

            break;

        case SecurityPolicy.Basic256.key:

            data.symmetricKeyLength         = 32;
            data.derivedEncryptionKeyLength = 32;
            data.derivedSignatureKeyLength  = 24;
            data.encryptingBlockSize        = 16;
            data.signatureLength            = 20;

            data.minimumAsymmetricKeyLength = 128;
            data.maximumAsymmetricKeyLength = 512;

            /* symmetric signature algorithm */
            data.symmetricSign              = HMAC_SHA1_Sign;
            data.symmetricVerify            = HMAC_SHA1_Verify;

            /* symmetric encryption algorithm */
            data.symmetricEncrypt           = AES_256_CBC_Encrypt;
            data.symmetricDecrypt           = AES_256_CBC_Decrypt;

            data.asymmetricSign             = RSAPKCS1OAEPSHA1_Sign;
            data.asymmetricVerify           = RSAPKCS1OAEPSHA1_Verify;
            /* asymmetric encryption algorithm */
            data.asymmetricEncrypt          = RSAOAEP_Encrypt;
            data.asymmetricDecrypt          = RSAOAEP_Decrypt;

            data.blockPaddingSize = 42;

            // "aes-256-cbc"
            data.symmetricEncryptionAlgorithm = "aes-256-cbc";
            data.compute_derived_keys       = compute_derived_keys;
            break;
        default:
            return null;
    }
    return data;
}
SecurityPolicy.getCryptoFactory = getCryptoFactory;

var s= require("../datamodel/structures");
var MessageSecurityMode = s.MessageSecurityMode;

function getOptionsForSymmetricSignAndEncrypt(securityMode,derivedKeys)
{
    assert(derivedKeys.hasOwnProperty("signatureLength"));
    assert(securityMode !== MessageSecurityMode.NONE && securityMode !== MessageSecurityMode.INVALID);

    var options = {
        signatureLength: derivedKeys.signatureLength,
        signingFunc: function (chunk) {
            return crypto_utils.makeMessageChunkSignatureWithDerivedKeys(chunk, derivedKeys);
        }
    };
    if (securityMode === MessageSecurityMode.SIGNANDENCRYPT) {

        options  = _.extend(options,{
            plainBlockSize:  derivedKeys.encryptingBlockSize,
            cipherBlockSize: derivedKeys.encryptingBlockSize,
            encrypt_buffer: function (chunk) {
                return crypto_utils.encryptBufferWithDerivedKeys(chunk, derivedKeys);
            }
        });
    }
    return options;
}
SecurityPolicy.getOptionsForSymmetricSignAndEncrypt = getOptionsForSymmetricSignAndEncrypt;
