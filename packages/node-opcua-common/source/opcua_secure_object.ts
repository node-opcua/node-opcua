/**
 * @module node-opcua-common
 */
import { EventEmitter } from "events";
import fs from "fs";

import { assert } from "node-opcua-assert";
import { Certificate, PrivateKey, readCertificate, readPrivateKey, split_der } from "node-opcua-crypto";

export interface ICertificateKeyPairProvider {
    getCertificate(): Certificate;
    getCertificateChain(): Certificate;
    getPrivateKey(): PrivateKey;
}
export interface ICertificateKeyPairProviderPriv extends ICertificateKeyPairProvider {
    $$certificate: null | Certificate;
    $$certificateChain: null | Certificate;
    $$privateKey: null | PrivateKey;
}
function _load_certificate(certificateFilename: string): Certificate {
    const der = readCertificate(certificateFilename);
    return der;
}

function _load_private_key(privateKeyFilename: string): PrivateKey {
    return readPrivateKey(privateKeyFilename);
}

export function getPartialCertificateChain1(certificateChain?: Buffer| null, maxSize?: number ): Buffer| undefined {

    return certificateChain  || undefined;
}
export function getPartialCertificateChain(certificateChain?: Buffer | null, maxSize?: number): Buffer | undefined {
    
    if (!certificateChain || certificateChain.length === 0) {
         return undefined;
    }
    if (maxSize === undefined) {
        return certificateChain;
    }
    const certificates = split_der(certificateChain);
    // at least include first certificate
    let buffer = certificates.length == 1 ? certificateChain : Buffer.from(certificates[0]);
    // Throw if first certificate already exceed maxSize
    if (buffer.length> maxSize) {
        throw new Error(`getPartialCertificateChain not enough space for leaf certificate ${maxSize} < ${buffer.length}`);
    }
    let index = 1;
    while (index < certificates.length && buffer.length + certificates[index].length < maxSize) {
        buffer = Buffer.concat([buffer, certificates[index]]);
        index++;
    }
    return buffer;

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
                // do it again for debug purposes
                priv.$$certificateChain = _load_certificate(this.certificateFile);
                throw new Error("Invalid certificate length = 0 " + this.certificateFile);
            }
        }
        return priv.$$certificateChain;
    }

    public getPrivateKey(): PrivateKey {
        const priv = this as unknown as ICertificateKeyPairProviderPriv;
        if (!priv.$$privateKey) {
            assert(fs.existsSync(this.privateKeyFile), "private file must exist :" + this.privateKeyFile);
            priv.$$privateKey = _load_private_key(this.privateKeyFile);
        }
        assert(!(priv.$$privateKey instanceof Buffer), "should not be a buffer");
        return priv.$$privateKey;
    }
}
