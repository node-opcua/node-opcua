"use strict";
/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

var crypto_utils = require("lib/misc/crypto_utils");
var fs = require("fs");
var assert = require("better-assert");

function _load_certificate(certificate_file) {
    return crypto_utils.readCertificate(certificate_file);
}
function _load_private_key(private_key_file) {
    return crypto_utils.readKeyPem(private_key_file);
}

/**
 * an object that provides a certificate and a privateKey
 * @class OPCUASecureObject
 * @param options
 * @param options.certificateFile {string}
 * @param options.privateKeyFile {string}
 * @constructor
 */
function OPCUASecureObject(options) {

    assert(typeof options.certificateFile === "string");
    assert(typeof options.privateKeyFile === "string");

    this._certificate = null;
    this.certificateFile = options.certificateFile;

    this._private_key_pem = null;
    this.privateKeyFile = options.privateKeyFile;

}

var split_der = require("lib/misc/crypto_explore_certificate").split_der;

/**
 * @method getCertificate
 * @return {Buffer}
 */
OPCUASecureObject.prototype.getCertificate = function () {

    if (!this._certificate) {
        var certChain    = this.getCertificateChain();
        this._certificate  = split_der(certChain)[0];
    }
    return this._certificate;
};

/**
 * @method getCertificateChain
 * @return {Buffer}
 */
OPCUASecureObject.prototype.getCertificateChain = function () {

    if (!this._certificateChain) {
        assert(fs.existsSync(this.certificateFile), "Certificate file must exist :" + this.certificateFile);
        this._certificateChain = _load_certificate(this.certificateFile);
    }
    return this._certificateChain;
};


/**
 * @method getPrivateKey
 * @return {Buffer}
 */
OPCUASecureObject.prototype.getPrivateKey = function () {

    if (!this._private_key_pem) {
        // create fake certificate
        //xx assert(fs.existsSync(this.privateKeyFile));
        this._private_key_pem = _load_private_key(this.privateKeyFile);
    }
    return this._private_key_pem;
};

exports.OPCUASecureObject = OPCUASecureObject;
