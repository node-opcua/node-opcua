/**
 * @module node-opcua-certificate-manager
 */
// tslint:disable:no-empty
import chalk from "chalk";
import * as fs from "fs";
import * as mkdirp from "mkdirp";

import envPaths from "env-paths";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";

import { StatusCodes } from "node-opcua-constants";
import {
    Certificate,
    exploreCertificateInfo,
    makeSHA1Thumbprint,
    readCertificate,
    toPem
} from "node-opcua-crypto";
import {
    CertificateManager,
    CertificateManagerOptions,
    CertificateStatus
} from "node-opcua-pki";
import { StatusCode } from "node-opcua-status-code";

const paths = envPaths("node-opcua");

type ErrorCallback = (err?: Error) => void;

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

type CallbackT<T> = (err: Error | null, result?: T) => void;
type StatusCodeCallback = (err: Error | null, statusCode?: StatusCode) => void;

export interface ICertificateManager {

    getTrustStatus(
      certificate: Certificate
    ): Promise<StatusCode>;

    getTrustStatus(
      certificate: Certificate,
      callback: StatusCodeCallback
    ): void;

    checkCertificate(
      certificate: Certificate
    ): Promise<StatusCode>;

    checkCertificate(
      certificate: Certificate,
      callback: StatusCodeCallback): void;

    /**
     *
     * @param certificate
     * @param callback
     */
    trustCertificate(
      certificate: Certificate,
      callback: (err?: Error | null) => void
    ): void;

    trustCertificate(certificate: Certificate): Promise<void>;

    rejectCertificate(
      certificate: Certificate,
      callback: (err?: Error | null) => void
    ): void;

    rejectCertificate(certificate: Certificate): Promise<void>;

}

type ReadFileFunc = (
  filename: string, encoding: string,
  callback: (err: Error | null, content?: Buffer) => void) => void;

export interface OPCUACertificateManagerOptions {
    /**
     * where to store the PKI
     * default %APPDATA%/node-opcua
     */
    rootFolder?: null | string;

    /**
     * the name of the pki store( default value = "pki" )
     *
     * the PKI folder will be <rootFolder>/<name>
     */
    name?: string;
}

export class OPCUACertificateManager extends CertificateManager implements ICertificateManager {
    /* */
    constructor(options: OPCUACertificateManagerOptions) {
        options = options || {};

        const location = options.rootFolder || paths.config;
        if (!fs.existsSync(location)) {
            mkdirp.sync(location);
        }

        const _options: CertificateManagerOptions = {
            keySize: 2048,
            location
        };
        super(_options);
    }

    public checkCertificate(certificate: Certificate): Promise<StatusCode>;
    public checkCertificate(certificate: Certificate, callback: StatusCodeCallback): void;
    public checkCertificate(certificate: Certificate, callback?: StatusCodeCallback): Promise<StatusCode> | void {
        super.verifyCertificate(certificate, (err?: Error | null, status?: string) => {
            if (err) {
                return callback!(err);
            }
            const statusCode = StatusCodes[status!];
            if (!statusCode) {
                return callback!(new Error("Invalid statusCode " + status));
            }
            callback!(null, statusCode);
        });
    }

    public async getTrustStatus(
      certificate: Certificate
    ): Promise<StatusCode>;
    public getTrustStatus(
      certificate: Certificate,
      callback: StatusCodeCallback
    ): void;
    public getTrustStatus(
      certificate: Certificate,
      callback?: StatusCodeCallback
    ): any {
        this.isCertificateTrusted(certificate, (err: Error | null, trustedStatus?: string) => {
            callback!(err,
              err ? undefined : StatusCodes[trustedStatus!]);
        });
    }

}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = { multiArgs: false };

OPCUACertificateManager.prototype.checkCertificate =
  thenify.withCallback(OPCUACertificateManager.prototype.checkCertificate, opts);
OPCUACertificateManager.prototype.getTrustStatus =
  thenify.withCallback(OPCUACertificateManager.prototype.getTrustStatus, opts);

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
        // tslint:disable-next-line:no-console
        console.log(chalk.red(" Sender certificate is invalid : certificate is not active yet !") +
          "  not before date =" + cert.notBefore
        );
        return StatusCodes.BadCertificateTimeInvalid;
    }
    if (cert.notAfter.getTime() <= now.getTime()) {
        // certificate is obsolete
        // tslint:disable-next-line:no-console
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
