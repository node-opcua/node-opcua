/**
 * @module node-opcua-certificate-manager
 */
// tslint:disable:no-empty
import fs from "fs";
import path from "path";
import mkdirp from "mkdirp";
import envPaths from "env-paths";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { Certificate, makeSHA1Thumbprint, split_der } from "node-opcua-crypto/web";
import { CertificateManager, CertificateManagerOptions } from "node-opcua-pki";
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

    public static registry = new ObjectRegistry();
    public referenceCounter: number;
    public automaticallyAcceptUnknownCertificate: boolean;
    /* */
    constructor(options: OPCUACertificateManagerOptions) {
        options = options || {};

        const location = options.rootFolder || paths.config;
        if (!fs.existsSync(location)) {
            try {
                mkdirp.sync(location);
            } catch (err) {
                errorLog(" cannot create folder ", location, fs.existsSync(location));
            }
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
        assert(callback && typeof callback === "function");
        return super.initialize().then(() => callback()).catch((err) => callback(err));
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
        this.#checkCertificate(certificateChain)
            .then((status) => callback(null, status))
            .catch((err) => callback(err));
    }
    async #checkCertificate(certificateChain: Certificate): Promise<StatusCode> {
        const status = await this.verifyCertificate(certificateChain);
          
        const statusCode = (StatusCodes as any)[status!];
        const certificates = split_der(certificateChain);

        debugLog("checkCertificate => StatusCode = ", statusCode.toString());
        if (statusCode.equals(StatusCodes.BadCertificateUntrusted)) {
            const topCertificateInChain = certificates[0];
            const thumbprint = makeSHA1Thumbprint(topCertificateInChain).toString("hex");
            if (this.automaticallyAcceptUnknownCertificate) {
                debugLog("automaticallyAcceptUnknownCertificate = true");
                debugLog("certificate with thumbprint " + thumbprint + " is now trusted");
                await this.trustCertificate(topCertificateInChain);
                return StatusCodes.Good;
            } else {
                debugLog("automaticallyAcceptUnknownCertificate = false");
                debugLog("certificate with thumbprint " + thumbprint + " is now rejected");
                await this.rejectCertificate(topCertificateInChain);
                return  StatusCodes.BadCertificateUntrusted;
            }
        } else if (statusCode.equals(StatusCodes.BadCertificateChainIncomplete)) {
            // put all certificates of the chain in the rejected folder
            const rejectAll = async (certificates: Certificate[]) => {
                for (const certificate of certificates) {
                    await this.rejectCertificate(certificate);
                }
            };
            await rejectAll(certificates);
            return statusCode;
        }
        return statusCode;
    }

    public async getTrustStatus(certificate: Certificate): Promise<StatusCode>;
    public getTrustStatus(certificate: Certificate, callback: StatusCodeCallback): void;
    public getTrustStatus(certificate: Certificate, callback?: StatusCodeCallback): any {
        this.isCertificateTrusted(certificate)
            .then((trustedStatus) => callback!(null, (StatusCodes as any)[trustedStatus!]))
            .catch((err) => callback!(err));
    }
    public async withLock2<T>(action: () => Promise<T>): Promise<T> {
        return await super.withLock2(action);
    }
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
import { withCallback } from "thenify-ex";
const opts = { multiArgs: false };

OPCUACertificateManager.prototype.checkCertificate = withCallback(OPCUACertificateManager.prototype.checkCertificate, opts);
OPCUACertificateManager.prototype.getTrustStatus = withCallback(OPCUACertificateManager.prototype.getTrustStatus, opts);
OPCUACertificateManager.prototype.initialize = withCallback(OPCUACertificateManager.prototype.initialize, opts);

export function getDefaultCertificateManager(name: "PKI" | "UserPKI"): OPCUACertificateManager {
    const config = envPaths("node-opcua-default").config;
    const pkiFolder = path.join(config, name);
    return new OPCUACertificateManager({
        name,
        rootFolder: pkiFolder,

        automaticallyAcceptUnknownCertificate: true
    });
}
