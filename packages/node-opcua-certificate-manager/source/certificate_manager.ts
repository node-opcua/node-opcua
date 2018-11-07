/**
 * @module node-opcua-certificate-manager
 */
import * as fs from "fs";
import * as path from "path";
import { callbackify, promisify } from "util";

import { StatusCodes } from "node-opcua-constants";
import { Certificate, makeSHA1Thumbprint, readCertificate, toPem } from "node-opcua-crypto";
import { StatusCode } from "node-opcua-status-code";

type ErrorCallback = (err?: Error) => void;

interface ICertificateManager {
    isCertificateTrusted(serverCertificate: Certificate, callback: ErrorCallback): void;
}

type ReadFileFunc = (
    filename: string, encoding: string,
    callback: (err: Error|null, content?: Buffer) => void) => void;

const fsFileExists = promisify(fs.exists);
const fsWriteFile = promisify(fs.writeFile);
const fsReadFile = promisify(fs.readFile as ReadFileFunc);
const fsRemoveFile = promisify(fs.unlink);

export interface CertificateManagerOptions {
    /**
     * where to store the PKI
     * the PKI will contain the trusted and untrusted certificate
     */
    rootFolder?: null| string;
}

export class CertificateManager implements ICertificateManager {

    private pkiUntrustedFolder: string = "";
    private pkiTrustedFolder: string = "";
    private readonly rootFolder: string;

    constructor(options?: CertificateManagerOptions) {

        options = options || {};
        this.rootFolder = options.rootFolder || process.cwd();
        this.constructPKI();
    }

    public isCertificateTrusted(certificate: Certificate,
                                callback: (err: Error | null, statusCode?: StatusCode) => void): void;

    public async isCertificateTrusted(certificate: Certificate): Promise<StatusCode>;
    public isCertificateTrusted(...args: any[]): any {
        const certificate = args[0] as Certificate;
        if (args.length === 1) {
            return this.privateIsCertificateTrusted(certificate);
        } else {
            // callback version
            const callback = args[0];
            return this.privateIsCertificateTrustedCallback(certificate, callback);
        }
    }

    /**
     *
     * @param certificate
     */
    public trustCertificate(certificate: Certificate): Promise<StatusCode>;
    /**
     * @internal
     * @param certificate
     * @param args
     */
    public trustCertificate(certificate: Certificate, ...args: any[]): any {
        if (args.length === 0) {
            return  this.privateTrustCertificate(certificate);
        } else {
            // callback version
            const callback = args[0];
            return this.privateTrustCertificateCallback(certificate, callback);
        }
    }

    private constructPKI() {

        const pkiFolder = path.join(this.rootFolder, "/pki");

        // istanbul ignore next
        if (!fs.existsSync(pkiFolder)) {
            fs.mkdirSync(pkiFolder);
        }

        this.pkiUntrustedFolder = path.join(pkiFolder, "untrusted");

        // istanbul ignore next
        if (!fs.existsSync(this.pkiUntrustedFolder)) {
            fs.mkdirSync(this.pkiUntrustedFolder);
        }

        this.pkiTrustedFolder = path.join(pkiFolder, "trusted");

        // istanbul ignore next
        if (!fs.existsSync(this.pkiTrustedFolder)) {
            fs.mkdirSync(this.pkiTrustedFolder);
        }

    }

    private privateIsCertificateTrustedCallback(
        certificate: Certificate,
        callback: (err: Error | null, statusCode?: StatusCode) => void): void {

    }

    private async privateIsCertificateTrusted(certificate: Certificate): Promise<StatusCode> {

        const thumbprint = makeSHA1Thumbprint(certificate);

        const certificateFilenameInTrusted = path.join(this.pkiTrustedFolder, thumbprint.toString("hex") + ".pem");

        const fileExist: boolean = await
            fsFileExists(certificateFilenameInTrusted);

        if (fileExist) {
            const content: Certificate = await readCertificate(certificateFilenameInTrusted);
            if ( content.toString("base64") !== certificate.toString("base64")) {
                return StatusCodes.BadCertificateInvalid;
            }
            return StatusCodes.Good;
        } else {
            const certificateFilename = path.join(this.pkiUntrustedFolder, thumbprint.toString("hex") + ".pem");
            await fsWriteFile(certificateFilename, toPem(certificate, "CERTIFICATE"));
            return StatusCodes.BadCertificateUntrusted;
        }
    }

    private privateTrustCertificateCallback(
        certificate: Certificate,
        callback: (err: Error | null, statusCode?: StatusCode) => void): void {

    }

    private async privateTrustCertificate(certificate: Certificate): Promise<StatusCode> {

        const thumbprint = makeSHA1Thumbprint(certificate);

        const certificateFilenameInTrusted = path.join(this.pkiTrustedFolder, thumbprint.toString("hex") + ".pem");
        const certificateFilenameInUntrusted = path.join(this.pkiUntrustedFolder, thumbprint.toString("hex") + ".pem");

        await fsWriteFile(certificateFilenameInTrusted, toPem(certificate, "CERTIFICATE"));

        // remove in UnTrusted
        if (await fsFileExists(certificateFilenameInUntrusted)) {
            await fsRemoveFile(certificateFilenameInUntrusted);
        }
        return StatusCodes.Good;
    }
}

(CertificateManager as any).prototype.privateIsCertificateTrustedCallback  =
    callbackify((CertificateManager as any).prototype.privateIsCertificateTrusted);

(CertificateManager as any).prototype.privateTrustCertificateCallback  =
    callbackify((CertificateManager as any).prototype.privateTrustCertificate);
