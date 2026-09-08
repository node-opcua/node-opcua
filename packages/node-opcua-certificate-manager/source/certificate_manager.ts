/**
 * @module node-opcua-certificate-manager
 */
import fs from "node:fs";
import path from "node:path";
import envPaths from "env-paths";
import { assert } from "node-opcua-assert";
import type { ICertificateStore } from "node-opcua-common";
import { type Certificate, makeSHA1Thumbprint } from "node-opcua-crypto/web";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { ObjectRegistry } from "node-opcua-object-registry";
import {
    CertificateManager,
    type CertificateManagerOptions,
    type IKeyOperations,
    type PrivateKeyPassphrase,
    type PrivateKeyProvider,
    resolvePrivateKeyPassphrase
} from "node-opcua-pki";
import { type StatusCode, type StatusCodeCallback, StatusCodes } from "node-opcua-status-code";

const paths = envPaths("node-opcua-default");

const debugLog = make_debugLog("certificate_manager");
const errorLog = make_errorLog("certificate_manager");
const warningLog = make_warningLog("certificate_manager");
const doDebug = checkDebugFlag("certificate_manager");

/**
 * Remove a lock file left in a PKI store by an older node-opcua, so that the
 * current one can use the store at all.
 *
 * node-opcua-pki serialises every mutation of a store (`withLock2`) on
 * `<rootFolder>/mutex.lock`. Today's global-mutex (3.x) takes that lock by
 * creating a *directory* of that name; its predecessor (2.x, built on the
 * `lockfile` package) created a plain *file* and left it behind when the
 * process died holding it. Neither provider of the current library treats that
 * file as the garbage it is: the native one only decides by mtime and waits
 * until the file looks two minutes old, the proper-lockfile one calls rmdir on
 * it, gets ENOTDIR and retries for hours. In both cases the first move into
 * rejected/ or trusted/ never answers, and an OpenSecureChannel that waits on
 * that verdict never answers either (FEAT-40, the CTT's Security Certificate
 * Validation scripts timing out on Windows).
 *
 * A regular file at that path can never be a live lock of the current library,
 * so it is removed before the store is first used. A directory is a real lock
 * and is left alone.
 *
 * @returns `true` when a file was removed
 */
export function removeLegacyLockFile(rootFolder: string): boolean {
    const legacyLockFile = path.join(rootFolder, "mutex.lock");
    let stats: fs.Stats;
    try {
        stats = fs.statSync(legacyLockFile);
    } catch {
        return false;
    }
    if (stats.isDirectory()) {
        return false;
    }
    try {
        fs.unlinkSync(legacyLockFile);
    } catch (err) {
        errorLog(`cannot remove the legacy lock file ${legacyLockFile}: ${(err as Error).message}`);
        return false;
    }
    warningLog(
        `[NODE-OPCUA-W38] removed ${legacyLockFile}: a lock file left by an older node-opcua, ` +
            "which would have stalled every update of this certificate store"
    );
    return true;
}

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
     * The folder that **is** the PKI store: `own/`, `trusted/`, `issuers/` and
     * `rejected/` are created directly under it. `name` is not appended.
     *
     * Two managers given the same `rootFolder` share one store and one
     * private key, whatever their `name`. Give every application, and every
     * side of an application (server side, client side), a folder of its own.
     *
     * @defaultValue the per-user config folder of node-opcua
     *   (`%APPDATA%/node-opcua-default` on Windows, `~/.config/node-opcua-default` elsewhere)
     */
    rootFolder?: null | string;

    automaticallyAcceptUnknownCertificate?: boolean;
    /**
     * A label for this store. It does **not** change where the store lives:
     * the folder is `rootFolder` alone. Callers that want one store per name
     * build the path themselves, as {@link getDefaultCertificateManager} does
     * with `rootFolder: path.join(config, name)`.
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

    /**
     * Use a private key this manager can never read: an opaque
     * `IKeyOperations` provider (HSM, KMS, TPM, OS keystore). Unlike
     * `privateKeyProvider` — which sources raw key material — the key never
     * enters the process: `getPrivateKey()` throws
     * `PrivateKeyUnavailableError` and every use goes through
     * `getKeyOperations()`. Mutually exclusive with `privateKeyProvider`
     * and `privateKeyPassphrase`. See node-opcua-pki's
     * private-key-protection guide for the full contract.
     *
     * @defaultValue undefined
     */
    keyOperations?: IKeyOperations;
}

export class OPCUACertificateManager extends CertificateManager implements ICertificateManager, ICertificateStore {
    public static defaultCertificateSubject = "/O=Sterfive/L=Orleans/C=FR";

    /**
     * How long {@link checkCertificate} waits, in milliseconds, for the store
     * to record its verdict (the move of the certificate into `rejected/` or
     * `trusted/`) before answering with that verdict anyway.
     *
     * The verdict is known before the move starts: the move is bookkeeping.
     * It takes the store's file lock, and a lock that is contended or stuck
     * must not hold the OpenSecureChannel of the client being answered (the
     * CTT gives up after 20 s and reports BadTimeout instead of the status the
     * server had already decided on). On timeout the move carries on in the
     * background and a warning is logged.
     */
    public static bookkeepingTimeout = 5000;

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
            privateKeyProvider: options.privateKeyProvider,
            keyOperations: options.keyOperations
        };
        super(_options);

        this.#privateKeyPassphrase = options.privateKeyPassphrase;
        this.#privateKeyManaged = !!options.privateKeyPassphrase || !!options.privateKeyProvider || !!options.keyOperations;

        this.referenceCounter = 0;

        this.automaticallyAcceptUnknownCertificate = !!options.automaticallyAcceptUnknownCertificate;
    }

    public async initialize(): Promise<void>;
    public initialize(callback: (err?: Error) => void): void;
    public initialize(...args: unknown[]): unknown {
        const callback = args[0] as (err?: Error) => void;
        assert(callback && typeof callback === "function");
        // before the first lock is taken: super.initialize() itself locks the store
        // when it has a key or a configuration file to write
        removeLegacyLockFile(this.rootDir);
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
                    await this.#bookkeeping("trust", thumbprint, this.trustCertificate(topCertificateInChain));
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
                await this.#bookkeeping("reject", thumbprint, this.rejectCertificate(topCertificateInChain));
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
            const thumbprint = makeSHA1Thumbprint(certificates[0]).toString("hex");
            await this.#bookkeeping("reject chain", thumbprint, rejectAll(certificates));
            return statusCode;
        }
        return statusCode;
    }

    /**
     * Wait for a store update, but not beyond {@link bookkeepingTimeout}: the
     * caller already knows the verdict it will return. A rejection of the
     * update propagates to the caller as before; a timeout is logged and the
     * update is left to complete (or fail, logged) on its own.
     */
    async #bookkeeping(what: string, thumbprint: string, update: Promise<void>): Promise<void> {
        let timer: NodeJS.Timeout | undefined;
        const expired = new Promise<"timeout">((resolve) => {
            timer = setTimeout(() => resolve("timeout"), OPCUACertificateManager.bookkeepingTimeout);
        });
        try {
            const outcome = await Promise.race([update.then(() => "done" as const), expired]);
            if (outcome === "timeout") {
                warningLog(
                    `[NODE-OPCUA-W39] the certificate store has not recorded the ${what} of ${thumbprint} ` +
                        `after ${OPCUACertificateManager.bookkeepingTimeout} ms (store ${this.rootDir}): ` +
                        "answering with the verdict already known; the store update goes on in the background"
                );
                update.catch((err: Error) => errorLog(`the ${what} of ${thumbprint} failed in the background: ${err.message}`));
            }
        } finally {
            clearTimeout(timer);
        }
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
