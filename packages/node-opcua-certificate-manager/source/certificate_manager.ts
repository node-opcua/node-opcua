// tslint:disable:no-empty
/**
 * @module node-opcua-certificate-manager
 */
import * as envPaths from "env-paths";
import * as fs from "fs";
import assert from "node-opcua-assert";
import * as path from "path";
import { callbackify, promisify } from "util";

import chalk from "chalk";
import * as mkdirp from "mkdirp";
import { StatusCodes } from "node-opcua-constants";
import { Certificate, exploreCertificateInfo, makeSHA1Thumbprint, readCertificate, toPem } from "node-opcua-crypto";
import { StatusCode } from "node-opcua-status-code";

const paths = envPaths("node-opcua");

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
     * default %APPDATA%/node-opcua
     */
    rootFolder?: null| string;

    /**
     * the name of the pki store( default value = "pki" )
     *
     * the PKI folder will be <rootFolder>/<name>
     */
    name?: string;
}
type StatusCodeCallback = (err: Error|null, statusCode?: StatusCode) => void;

export class CertificateManager implements ICertificateManager {

    public pkiUntrustedFolder: string = "";
    public pkiTrustedFolder: string = "";
    public readonly rootFolder: string;
    public readonly name: string;

    constructor(options?: CertificateManagerOptions) {

        options = options || {};
        this.rootFolder = options.rootFolder || paths.config;
        this.name = options.name || "PKI";
        this.constructPKI();
    }

    public async checkCertificate(
        certificate: Certificate
    ): Promise<StatusCode>;
    public checkCertificate(
        certificate: Certificate,
        callback: StatusCodeCallback): void;
    public checkCertificate(certificate: Certificate, ...args: any[]): any {
        if (args.length === 0) {
            return this.privateCheckCertificate(certificate);
        }
        const callback = args[0] as StatusCodeCallback;
        assert(callback instanceof Function);
        return this.privateCheckCertificateCallback(certificate, callback);
    }

    public isCertificateTrusted(certificate: Certificate,
                                callback: StatusCodeCallback): void;

    public async isCertificateTrusted(certificate: Certificate): Promise<StatusCode>;
    public isCertificateTrusted(certificate: Certificate, ...args: any[]): any {
        if (args.length === 0) {
            return this.privateIsCertificateTrusted(certificate);
        } else {
            // callback version
            const callback = args[0] as StatusCodeCallback;
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
    /**
     *
     * @param certificate
     */
    public untrustCertificate(certificate: Certificate): Promise<StatusCode>;
    /**
     * @internal
     * @param certificate
     * @param args
     */
    public untrustCertificate(certificate: Certificate, ...args: any[]): any {
        if (args.length === 0) {
            return  this.privateUntrustCertificate(certificate);
        } else {
            // callback version
            const callback = args[0];
            return this.privateUntrustCertificateCallback(certificate, callback);
        }
    }

    private constructPKI() {

        // istanbul ignore next
        if (!fs.existsSync(this.rootFolder)) {
            mkdirp.sync(this.rootFolder);
        }
        const pkiFolder = path.join(this.rootFolder, this.name);

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
            if (! await fsFileExists(certificateFilename)) {
                await fsWriteFile(certificateFilename, toPem(certificate, "CERTIFICATE"));
            }
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

    private privateUntrustCertificateCallback(
        certificate: Certificate,
        callback: (err: Error | null, statusCode?: StatusCode) => void): void {

    }

    private async privateUntrustCertificate(certificate: Certificate): Promise<StatusCode> {

        const thumbprint = makeSHA1Thumbprint(certificate);

        const certificateFilenameInTrusted = path.join(this.pkiTrustedFolder, thumbprint.toString("hex") + ".pem");
        const certificateFilenameInUntrusted = path.join(this.pkiUntrustedFolder, thumbprint.toString("hex") + ".pem");

        await fsWriteFile(certificateFilenameInUntrusted, toPem(certificate, "CERTIFICATE"));

        // remove in UnTrusted
        if (await fsFileExists(certificateFilenameInTrusted)) {
            await fsRemoveFile(certificateFilenameInTrusted);
        }
        return StatusCodes.Good;
    }

    private privateCheckCertificateCallback(
        certificate: Certificate,
        callback: (err: Error | null, statusCode?: StatusCode) => void): void {

    }
    private async privateCheckCertificate(certificate: Certificate): Promise<StatusCode> {

        const statusCode = checkCertificateValidity(certificate);
        if (statusCode !== StatusCodes.Good) {
            return statusCode;
        }
        return await this.privateIsCertificateTrusted(certificate);
    }
}

(CertificateManager as any).prototype.privateIsCertificateTrustedCallback  =
    callbackify((CertificateManager as any).prototype.privateIsCertificateTrusted);

(CertificateManager as any).prototype.privateTrustCertificateCallback  =
    callbackify((CertificateManager as any).prototype.privateTrustCertificate);

(CertificateManager as any).prototype.privateUntrustCertificateCallback  =
    callbackify((CertificateManager as any).prototype.privateUntrustCertificate);

(CertificateManager as any).prototype.privateCheckCertificateCallback  =
    callbackify((CertificateManager as any).prototype.privateCheckCertificate);

// also see OPCUA 1.02 part 4 :
//  - page 95  6.1.3 Determining if a Certificate is Trusted
// -  page 100 6.2.3 Validating a Software Certificate
//
export function checkCertificateValidity(certificate: Certificate): StatusCode {
    // Is the  signature on the SoftwareCertificate valid .?
    if (!certificate) {
        // missing certificate
        return StatusCodes.BadSecurityChecksFailed;
    }

    // Has SoftwareCertificate passed its issue date and has it not expired ?
    // check dates
    const cert = exploreCertificateInfo(certificate);

    const now = new Date();

    if (cert.notBefore.getTime() > now.getTime()) {
        // certificate is not active yet
        console.log(chalk.red(" Sender certificate is invalid : certificate is not active yet !") +
            "  not before date =" + cert.notBefore
        );
        return StatusCodes.BadCertificateTimeInvalid;
    }
    if (cert.notAfter.getTime() <= now.getTime()) {
        // certificate is obsolete
        console.log(chalk.red(" Sender certificate is invalid : certificate has expired !") +
            " not after date =" + cert.notAfter);
        return StatusCodes.BadCertificateTimeInvalid;
    }

    // Has SoftwareCertificate has  been revoked by the issuer ?
    // TODO: check if certificate is revoked or not ...
    // StatusCodes.BadCertificateRevoked

    // is issuer Certificate  valid and has not been revoked by the CA that issued it. ?
    // TODO : check validity of issuer certificate
    // StatusCodes.BadCertificateIssuerRevoked

    // does the URI specified in the ApplicationDescription  match the URI in the Certificate ?
    // TODO : check ApplicationDescription of issuer certificate
    // return StatusCodes.BadCertificateUriInvalid

    return StatusCodes.Good;
}
