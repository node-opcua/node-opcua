var crypto_utils = require("./../misc/crypto_utils");
var fs = require("fs");
var assert = require("better-assert");

function _load_certificate(certificate_file) {
    return  crypto_utils.readCertificate(certificate_file);
}
function _load_private_key(private_key_file) {
    return crypto_utils.readKeyPem(private_key_file);
}

function OPCUASecureObject(options)
{

    assert(typeof options.certificateFile === "string");
    assert(typeof options.privateKeyFile === "string");

    this.certificateFile =options.certificateFile;
    this._certificate = null;

    this._private_key_pem =  null;
    this.privateKeyFile =options.privateKeyFile;

}


/**
 * @method getCertificate
 * @return {Buffer}
 */
OPCUASecureObject.prototype.getCertificate = function() {

    if (!this._certificate) {
        assert(fs.existsSync(this.certificateFile));
        this._certificate = _load_certificate(this.certificateFile);
    }
    return this._certificate;
};


/**
 * @method getPrivateKey
 * @return {Buffer}
 */
OPCUASecureObject.prototype.getPrivateKey = function() {

    if (!this._private_key_pem) {
        // create fake certificate
        assert(fs.existsSync(this.privateKeyFile));
        this._private_key_pem = _load_private_key(this.privateKeyFile);
    }
    return this._private_key_pem;
};

exports.OPCUASecureObject = OPCUASecureObject;
