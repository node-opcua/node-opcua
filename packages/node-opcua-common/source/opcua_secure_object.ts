/**
 * @module node-opcua-common
 */
import { EventEmitter } from "events";
import * as fs from "fs";

import { assert } from "node-opcua-assert";
import { Certificate, PrivateKeyPEM, readCertificate, readKeyPem, split_der } from "node-opcua-crypto";

export interface ICertificateKeyPairProvider {
    getCertificate(): Certificate;
    getCertificateChain(): Certificate;
    getPrivateKey(): PrivateKeyPEM;
}
export interface ICertificateKeyPairProviderPriv extends ICertificateKeyPairProvider {
    $$certificate: null | Certificate;
    $$certificateChain: null | Certificate;
    $$privateKeyPEM: null | PrivateKeyPEM;
}
function _load_certificate(certificateFilename: string): Certificate {
    const der = readCertificate(certificateFilename);
    return der;
}

function _load_private_key_pem(privateKeyFilename: string): PrivateKeyPEM {
    return readKeyPem(privateKeyFilename);
}

export interface IOPCUASecureObjectOptions {
    certificateFile?: string;
    privateKeyFile?: string;
}

/**
 * an object that provides a certificate and a privateKey
 * @class OPCUASecureObject
 * @param options
 * @param options.certificateFile {string}
 * @param options.privateKeyFile {string}
 * @constructor
 */
export class OPCUASecureObject extends EventEmitter implements ICertificateKeyPairProvider {
    public readonly certificateFile: string;
    public readonly privateKeyFile: string;

    constructor(options: IOPCUASecureObjectOptions) {
        super();
        assert(typeof options.certificateFile === "string");
        assert(typeof options.privateKeyFile === "string");

        this.certificateFile = options.certificateFile || "invalid certificate file";
        this.privateKeyFile = options.privateKeyFile || "invalid private key file";
    }

    public getCertificate(): Certificate {
        const priv = this as unknown as ICertificateKeyPairProviderPriv;
        if (!priv.$$certificate) {
            const certChain = this.getCertificateChain();
            priv.$$certificate = split_der(certChain)[0] as Certificate;
        }
        return priv.$$certificate;
    }

    public getCertificateChain(): Certificate {
        const priv = this as unknown as ICertificateKeyPairProviderPriv;
        if (!priv.$$certificateChain) {
            assert(fs.existsSync(this.certificateFile), "Certificate file must exist :" + this.certificateFile);
            priv.$$certificateChain = _load_certificate(this.certificateFile);
            if (priv.$$certificateChain && priv.$$certificateChain.length === 0) {
                priv.$$certificateChain = _load_certificate(this.certificateFile);
                throw new Error("Invalid certificate length = 0 " + this.certificateFile);
            }
        }
        return priv.$$certificateChain;
    }

    public getPrivateKey(): PrivateKeyPEM {
        const priv = this as unknown as ICertificateKeyPairProviderPriv;
        if (!priv.$$privateKeyPEM) {
            assert(fs.existsSync(this.privateKeyFile), "private file must exist :" + this.privateKeyFile);
            priv.$$privateKeyPEM = _load_private_key_pem(this.privateKeyFile);
        }
        return priv.$$privateKeyPEM;
    }
}
