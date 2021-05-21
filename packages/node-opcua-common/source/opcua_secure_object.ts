/**
 * @module node-opcua-common
 */
import * as chalk from "chalk";
import { EventEmitter } from "events";
import * as fs from "fs";
import { assert } from "node-opcua-assert";
import {
    Certificate,
    PrivateKeyPEM, readCertificate,
    readKeyPem, split_der
} from "node-opcua-crypto";

export interface ICertificateKeyPairProvider {
    getCertificate(): Certificate;
    getCertificateChain(): Certificate;
    getPrivateKey(): PrivateKeyPEM;
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

    private certificate: null | Certificate;
    private certificateChain: null | Certificate;
    private privateKeyPEM: null | PrivateKeyPEM;

    constructor(options: IOPCUASecureObjectOptions) {

        super();
        this.certificate = null;
        this.certificateChain = null;
        this.privateKeyPEM = null;

        assert(typeof options.certificateFile === "string");
        assert(typeof options.privateKeyFile === "string");

        this.certificateFile = options.certificateFile || "invalid certificate file";
        this.privateKeyFile = options.privateKeyFile || "invalid private key file";
    }

    public getCertificate(): Certificate {
        if (!this.certificate) {
            const certChain = this.getCertificateChain();
            this.certificate = split_der(certChain)[0] as Certificate;
        }
        return this.certificate;
    }

    public getCertificateChain(): Certificate {
        if (!this.certificateChain) {
            assert(fs.existsSync(this.certificateFile), "Certificate file must exist :" + this.certificateFile);
            this.certificateChain = _load_certificate(this.certificateFile);
            if (  this.certificateChain  &&   this.certificateChain.length ===0) {
                this.certificateChain = _load_certificate(this.certificateFile);
                throw new Error("Invalid certificate length = 0 " + this.certificateFile);
            }
        }
        return this.certificateChain;
    }

    public getPrivateKey(): PrivateKeyPEM {
        if (!this.privateKeyPEM) {
            assert(fs.existsSync(this.privateKeyFile), "private file must exist :" + this.privateKeyFile);
            this.privateKeyPEM = _load_private_key_pem(this.privateKeyFile);
        }
        return this.privateKeyPEM;
    }
}
