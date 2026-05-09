/**
 * @module node-opcua-certificate-manager
 */
import fs from "node:fs";
import path from "node:path";
import envPaths from "env-paths";
import { assert } from "node-opcua-assert";
import { type Certificate, makeSHA1Thumbprint } from "node-opcua-crypto/web";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import type { ICertificateStore } from "node-opcua-common";
import { ObjectRegistry } from "node-opcua-object-registry";
import { CertificateManager, type CertificateManagerOptions } from "node-opcua-pki";
import { type StatusCode, type StatusCodeCallback, StatusCodes } from "node-opcua-status-code";

const paths = envPaths("node-opcua-default");

const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);
const _doDebug = checkDebugFlag(__filename);

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

    /**
     * When `true`, file-system watchers (chokidar) on the PKI
     * folders are disabled.  The initial scan still populates
     * the in-memory indexes but live change detection is off.
     *
     * Useful in test / CI pipelines where many servers start
     * in parallel and the accumulated `fs.watch` handles
     * exhaust the libuv thread-pool.
     *
     * @defaultValue false
     */
    disableFileWatchers?: boolean;
}

export class OPCUACertificateManager extends CertificateManager implements ICertificateManager, ICertificateStore {
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
                fs.mkdirSync(location, { recursive: true });
            } catch (_err) {
                errorLog(" cannot create folder ", location, fs.existsSync(location));
            }
        }

        const _options: CertificateManagerOptions = {
            keySize: options.keySize || 2048,
            location,
            disableFileWatchers: options.disableFileWatchers
        };
        super(_options);

        this.referenceCounter = 0;

        this.automaticallyAcceptUnknownCertificate = !!options.automaticallyAcceptUnknownCertificate;
    }

    public async initialize(): Promise<void>;
    public initialize(callback: (err?: Error) => void): void;
    public initialize(...args: unknown[]): unknown {
        const callback = args[0] as (err?: Error) => void;
        assert(callback && typeof callback === "function");
        return super
            .initialize()
            .then(() => callback())
            .catch((err) => callback(err as Error));
    }

    public async dispose(): Promise<void> {
        if (this.referenceCounter === 0) {
            await super.dispose();
        } else {
            this.referenceCounter--;
        }
    }

    public checkCertificate(certificateChain: Certificate | Certificate[]): Promise<StatusCode>;
    public checkCertificate(certificateChain: Certificate | Certificate[], callback: StatusCodeCallback): void;
    public checkCertificate(
        certificateChain: Certificate | Certificate[],
        callback?: StatusCodeCallback
    ): Promise<StatusCode> | undefined {
        // c8 ignore next
        if (!callback || typeof callback !== "function") {
            throw new Error("Internal error");
        }
        this.#checkCertificate(certificateChain)
            .then((status) => callback(null, status))
            .catch((err) => callback(err));
        return undefined;
    }
    async #checkCertificate(certificateChain: Certificate | Certificate[]): Promise<StatusCode> {
        const certificates = Array.isArray(certificateChain) ? certificateChain : [certificateChain];

        const status = await this.verifyCertificate(Buffer.concat(certificates), { acceptCertificateWithValidIssuerChain: true });

        const statusCode = StatusCodes[status];

        debugLog(`checkCertificate => StatusCode = ${statusCode.toString()}`);
        if (statusCode.equals(StatusCodes.BadCertificateUntrusted)) {
            const topCertificateInChain = certificates[0];
            const thumbprint = makeSHA1Thumbprint(topCertificateInChain).toString("hex");
            if (this.automaticallyAcceptUnknownCertificate) {
                debugLog("automaticallyAcceptUnknownCertificate = true");
                debugLog(`certificate with thumbprint ${thumbprint} is now trusted (was: ${statusCode.toString()})`);
                try {
                    await this.trustCertificate(topCertificateInChain);
                } catch (err) {
                    if (err && (err as Error & { code: string }).code === "ENOENT") {
                        // Another concurrent caller already moved the certificate
                        // from rejected to trusted — verify it's now trusted.
                        const trustStatus = await this.getTrustStatus(topCertificateInChain);
                        if (trustStatus.equals(StatusCodes.Good)) {
                            debugLog(`certificate with thumbprint ${thumbprint} was already trusted by another caller`);
                            return StatusCodes.Good;
                        }
                    }
                    throw err;
                }
                return StatusCodes.Good;
            } else {
                debugLog("automaticallyAcceptUnknownCertificate = false");
                debugLog(`certificate with thumbprint ${thumbprint} is now rejected`);
                await this.rejectCertificate(topCertificateInChain);
                return StatusCodes.BadCertificateUntrusted;
            }
        } else if (statusCode.equals(StatusCodes.BadCertificateRevocationUnknown)) {
            // Revocation status unknown (missing CRL) — don't conflate
            // with BadCertificateUntrusted. If auto-accept is enabled,
            // trust the certificate anyway; otherwise return the accurate
            // status code so the caller knows the CRL is missing.
            const topCertificateInChain = certificates[0];
            if (this.automaticallyAcceptUnknownCertificate) {
                const thumbprint = makeSHA1Thumbprint(topCertificateInChain).toString("hex");
                debugLog("automaticallyAcceptUnknownCertificate = true (revocation unknown)");
                debugLog(`certificate with thumbprint ${thumbprint} is now trusted despite unknown revocation status`);
                await this.trustCertificate(topCertificateInChain);
                return StatusCodes.Good;
            }
            return statusCode;
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
    public getTrustStatus(certificate: Certificate, callback?: StatusCodeCallback): Promise<StatusCode> | undefined {
        // c8 ignore next
        if (!callback || typeof callback !== "function") {
            throw new Error("Internal error");
        }
        this.isCertificateTrusted(certificate)
            .then((trustedStatus) =>
                callback(null, StatusCodes[trustedStatus as unknown as keyof typeof StatusCodes] as StatusCode)
            )
            .catch((err) => callback(err));
        return undefined;
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
