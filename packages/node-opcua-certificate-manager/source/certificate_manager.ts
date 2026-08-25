/**
 * @module node-opcua-certificate-manager
 */
import fs from "node:fs";
import path from "node:path";
import envPaths from "env-paths";
import { assert } from "node-opcua-assert";
import type { ICertificateStore } from "node-opcua-common";
import { type Certificate, makeSHA1Thumbprint } from "node-opcua-crypto/web";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { ObjectRegistry } from "node-opcua-object-registry";
import {
    CertificateManager,
    type CertificateManagerOptions,
    type PrivateKeyPassphrase,
    type PrivateKeyProvider,
    resolvePrivateKeyPassphrase
} from "node-opcua-pki";
import { type StatusCode, type StatusCodeCallback, StatusCodes } from "node-opcua-status-code";

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

    /**
     * Encrypt the private key at rest with this passphrase (opt-in,
     * default off — a plaintext key is written, exactly as before). When set:
     * - a freshly generated key is written already encrypted (PKCS#8);
     * - an existing *plaintext* key is re-encrypted in place by
     *   {@link OPCUACertificateManager.initialize}, so turning the option on
     *   for an existing install never leaves the key in cleartext;
     * - an existing encrypted key requires the same passphrase — a mismatch,
     *   or an encrypted key with no passphrase configured, fails
     *   `initialize()` closed with `PrivateKeyPassphraseRequiredError`.
     *
     * A function is called at most once per `OPCUACertificateManager`
     * instance (the decrypted key is cached in memory for the instance's
     * lifetime, see {@link OPCUACertificateManager.getPrivateKey}). Never
     * logged.
     *
     * The in-process default managers returned by
     * {@link getDefaultCertificateManager} (memoized by name, e.g. `"PKI"` /
     * `"UserPKI"`) are always passphrase-less — construct your own
     * `OPCUACertificateManager` and pass it as `serverCertificateManager` /
     * `clientCertificateManager` to use passphrase protection.
     *
     * @defaultValue undefined (plaintext key)
     */
    privateKeyPassphrase?: PrivateKeyPassphrase;

    /**
     * Source the private key from somewhere other than
     * `own/private/private_key.pem` (an HSM, a KMS, ...). When set, it
     * overrides disk entirely for every operation that needs the private
     * key — the on-disk file is not read, and `privateKeyPassphrase` is
     * ignored.
     *
     * @defaultValue undefined
     */
    privateKeyProvider?: PrivateKeyProvider;
}

export class OPCUACertificateManager extends CertificateManager implements ICertificateManager, ICertificateStore {
    public static defaultCertificateSubject = "/O=Sterfive/L=Orleans/C=FR";

    public static registry = new ObjectRegistry();
    public referenceCounter: number;
    public automaticallyAcceptUnknownCertificate: boolean;
    readonly #privateKeyPassphrase?: PrivateKeyPassphrase;
    readonly #privateKeyManaged: boolean;
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
            disableFileWatchers: options.disableFileWatchers,
            privateKeyPassphrase: options.privateKeyPassphrase,
            privateKeyProvider: options.privateKeyProvider
        };
        super(_options);

        this.#privateKeyPassphrase = options.privateKeyPassphrase;
        this.#privateKeyManaged = !!options.privateKeyPassphrase || !!options.privateKeyProvider;

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

    /**
     * Resolve this manager's configured `privateKeyPassphrase` (calling it,
     * if it is a function, at most once — see
     * {@link resolvePrivateKeyPassphrase}). Returns `undefined` when no
     * passphrase is configured (plaintext key).
     *
     * Intended for callers that need to write a *new* private key to disk
     * with the same protection as this manager (push certificate
     * management), rather than for reading the current key — prefer
     * {@link CertificateManager.getPrivateKey} for that.
     */
    public async getPrivateKeyPassphrase(): Promise<string | undefined> {
        return resolvePrivateKeyPassphrase(this.#privateKeyPassphrase);
    }

    /**
     * `true` when this manager was constructed with `privateKeyPassphrase`
     * and/or `privateKeyProvider` — i.e. `getPrivateKey()` may need to do
     * asynchronous work (decrypt, or fetch from an external source) rather
     * than a plain synchronous disk read.
     *
     * Consumers (e.g. `OPCUAServer`/`OPCUAClient`'s private-key resolution)
     * use this to decide whether installing an async-resolved, permanently
     * cached provider is necessary at all: for a manager with neither option
     * set, the on-disk key is always plaintext, so a plain
     * `DiskCertificateKeyPairProvider` keeps working exactly as before —
     * including re-reading a manually replaced key after `invalidate()`,
     * which a resolved provider deliberately does not do (see
     * {@link ResolvedCertificateKeyPairProvider} in `node-opcua-common`).
     */
    public isPrivateKeyManaged(): boolean {
        return this.#privateKeyManaged;
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

        // c8 ignore next
        doDebug && debugLog(`checkCertificate => StatusCode = ${statusCode.toString()}`);
        if (statusCode.equals(StatusCodes.BadCertificateUntrusted)) {
            const topCertificateInChain = certificates[0];
            const thumbprint = makeSHA1Thumbprint(topCertificateInChain).toString("hex");
            if (this.automaticallyAcceptUnknownCertificate) {
                // c8 ignore next
                if (doDebug) {
                    debugLog("automaticallyAcceptUnknownCertificate = true");
                    debugLog(`certificate with thumbprint ${thumbprint} is now trusted (was: ${statusCode.toString()})`);
                }
                try {
                    await this.trustCertificate(topCertificateInChain);
                } catch (err) {
                    if (err && (err as Error & { code: string }).code === "ENOENT") {
                        // Another concurrent caller already moved the certificate
                        // from rejected to trusted — verify it's now trusted.
                        const trustStatus = await this.getTrustStatus(topCertificateInChain);
                        if (trustStatus.equals(StatusCodes.Good)) {
                            // c8 ignore next
                            doDebug && debugLog(`certificate with thumbprint ${thumbprint} was already trusted by another caller`);
                            return StatusCodes.Good;
                        }
                    }
                    throw err;
                }
                return StatusCodes.Good;
            } else {
                // c8 ignore next
                if (doDebug) {
                    debugLog("automaticallyAcceptUnknownCertificate = false");
                    debugLog(`certificate with thumbprint ${thumbprint} is now rejected`);
                }
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
                // c8 ignore next
                if (doDebug) {
                    debugLog("automaticallyAcceptUnknownCertificate = true (revocation unknown)");
                    debugLog(`certificate with thumbprint ${thumbprint} is now trusted despite unknown revocation status`);
                }
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

import { withCallback } from "thenify-ex";

const opts = { multiArgs: false };

OPCUACertificateManager.prototype.checkCertificate = withCallback(OPCUACertificateManager.prototype.checkCertificate, opts);
OPCUACertificateManager.prototype.getTrustStatus = withCallback(OPCUACertificateManager.prototype.getTrustStatus, opts);
OPCUACertificateManager.prototype.initialize = withCallback(OPCUACertificateManager.prototype.initialize, opts);

const _defaultCertificateManagers: Map<string, OPCUACertificateManager> = new Map();

export function getDefaultCertificateManager(name: "PKI" | "UserPKI"): OPCUACertificateManager {
    let cm = _defaultCertificateManagers.get(name);
    if (!cm) {
        const config = envPaths("node-opcua-default").config;
        const pkiFolder = path.join(config, name);
        cm = new OPCUACertificateManager({
            name,
            rootFolder: pkiFolder,
            automaticallyAcceptUnknownCertificate: true
        });
        _defaultCertificateManagers.set(name, cm);
    }
    // Increment so that individual callers' dispose() calls
    // just decrement without destroying the shared instance.
    cm.referenceCounter++;
    return cm;
}
