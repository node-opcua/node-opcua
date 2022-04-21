/**
 * @module node-opcua-certificate-manager
 */
// tslint:disable:no-empty
import * as fs from "fs";
import * as path from "path";

import * as mkdirp from "mkdirp";
import envPaths = require("env-paths");
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";

import {
     Certificate, 
     makeSHA1Thumbprint    } from "node-opcua-crypto";
import { 
    CertificateManager, 
    CertificateManagerOptions} from "node-opcua-pki";
import { StatusCodes } from "node-opcua-status-code";
import { StatusCode } from "node-opcua-status-code";

import { StatusCodeCallback } from "node-opcua-status-code";
import { assert } from "node-opcua-assert";

import { ObjectRegistry } from "node-opcua-object-registry";

const paths = envPaths("node-opcua-default");

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const doDebug = checkDebugFlag(__filename);

export interface ICertificateManager {
    getTrustStatus(certificate: Certificate): Promise<StatusCode>;

    getTrustStatus(certificate: Certificate, callback: StatusCodeCallback): void;

    checkCertificate(certificate: Certificate): Promise<StatusCode>;

    checkCertificate(certificate: Certificate, callback: StatusCodeCallback): void;

    /**
     *
     * @param certificate
     * @param callback
     */
    trustCertificate(certificate: Certificate, callback: (err?: Error | null) => void): void;

    trustCertificate(certificate: Certificate): Promise<void>;

    rejectCertificate(certificate: Certificate, callback: (err?: Error | null) => void): void;

    rejectCertificate(certificate: Certificate): Promise<void>;
}

type ReadFileFunc = (filename: string, encoding: string, callback: (err: Error | null, content?: Buffer) => void) => void;

export interface OPCUACertificateManagerOptions {
    /**
     * where to store the PKI
     * default %APPDATA%/node-opcua-default
     */
    rootFolder?: null | string;

    automaticallyAcceptUnknownCertificate?: boolean;
    /**
     * the name of the pki store( default value = "pki" )
     *
     * the PKI folder will be <rootFolder>/<name>
     */
    name?: string;

    /**
     *
     */
    keySize?: 2048 | 3072 | 4096;
}

export class OPCUACertificateManager extends CertificateManager implements ICertificateManager {
    public static defaultCertificateSubject = "/O=Sterfive/L=Orleans/C=FR";

    public static registry = new ObjectRegistry({});
    public referenceCounter: number;
    public automaticallyAcceptUnknownCertificate: boolean;
    /* */
    constructor(options: OPCUACertificateManagerOptions) {
        options = options || {};

        const location = options.rootFolder || paths.config;
        if (!fs.existsSync(location)) {
            mkdirp.sync(location);
        }

        const _options: CertificateManagerOptions = {
            keySize: options.keySize || 2048,
            location
        };
        super(_options);

        this.referenceCounter = 0;

        this.automaticallyAcceptUnknownCertificate = !!options.automaticallyAcceptUnknownCertificate;
    }

    public async initialize(): Promise<void>;
    public initialize(callback: (err?: Error) => void): void;
    public initialize(...args: any[]): any {
        const callback = args[0];
        assert(callback && typeof callback === 'function');
        return super.initialize(callback);
    }

    public async dispose(): Promise<void> {
        if (this.referenceCounter === 0) {
            await super.dispose();
        } else {
            this.referenceCounter--;
        }
    }

    public checkCertificate(certificateChain: Certificate): Promise<StatusCode>;
    public checkCertificate(certificateChain: Certificate, callback: StatusCodeCallback): void;
    public checkCertificate(certificateChain: Certificate, callback?: StatusCodeCallback): Promise<StatusCode> | void {
        // istanbul ignore next
        if (!callback || typeof callback !== "function") {
            throw new Error("Internal error");
        }

        this.verifyCertificate(certificateChain, (err1?: Error | null, status?: string) => {
            // istanbul ignore next
            if (err1) {
                return callback!(err1);
            }
            const statusCode = (StatusCodes as any)[status!];

            debugLog("checkCertificate => StatusCode = ", statusCode.toString());
            if (statusCode === StatusCodes.BadCertificateUntrusted) {
                const thumbprint = makeSHA1Thumbprint(certificateChain).toString("hex");
                if (this.automaticallyAcceptUnknownCertificate) {
                    debugLog("automaticallyAcceptUnknownCertificate = true");
                    debugLog("certificate with thumbprint " + thumbprint + " is now trusted");
                    return this.trustCertificate(certificateChain, () => callback!(null, StatusCodes.Good));
                } else {
                    debugLog("automaticallyAcceptUnknownCertificate = false");
                    debugLog("certificate with thumbprint " + thumbprint + " is now rejected");
                    return this.rejectCertificate(certificateChain, () => callback!(null, StatusCodes.BadCertificateUntrusted));
                }
            }
            callback!(null, statusCode);
        });
    }

    public async getTrustStatus(certificate: Certificate): Promise<StatusCode>;
    public getTrustStatus(certificate: Certificate, callback: StatusCodeCallback): void;
    public getTrustStatus(certificate: Certificate, callback?: StatusCodeCallback): any {
        this.isCertificateTrusted(certificate, (err: Error | null, trustedStatus?: string) => {
            callback!(err, err ? undefined : (StatusCodes as any)[trustedStatus!]);
        });
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
const opts = { multiArgs: false };

OPCUACertificateManager.prototype.checkCertificate = thenify.withCallback(OPCUACertificateManager.prototype.checkCertificate, opts);
OPCUACertificateManager.prototype.getTrustStatus = thenify.withCallback(OPCUACertificateManager.prototype.getTrustStatus, opts);
OPCUACertificateManager.prototype.initialize = thenify.withCallback(OPCUACertificateManager.prototype.initialize, opts);

export function getDefaultCertificateManager(name: "PKI" | "UserPKI"): OPCUACertificateManager {
    const config = envPaths("node-opcua-default").config;
    const pkiFolder = path.join(config, name);
    return new OPCUACertificateManager({
        name,
        rootFolder: pkiFolder,

        automaticallyAcceptUnknownCertificate: true
    });
}
