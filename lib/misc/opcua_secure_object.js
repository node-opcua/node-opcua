/**
 * @module opcua.miscellaneous
 */
require("requirish")._(module);

import crypto_utils from "lib/misc/crypto_utils";
import fs from "fs";
import assert from "better-assert";

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

import {split_der} from "lib/misc/crypto_explore_certificate";

/**
 * @method getCertificate
 * @return {Buffer}
 */
OPCUASecureObject.prototype.getCertificate = function () {
  if (!this._certificate) {
    const certChain    = this.getCertificateChain();
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
    assert(fs.existsSync(this.certificateFile), `Certificate file must exist :${this.certificateFile}`);
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
        // xx assert(fs.existsSync(this.privateKeyFile));
    this._private_key_pem = _load_private_key(this.privateKeyFile);
  }
  return this._private_key_pem;
};

export {OPCUASecureObject};
