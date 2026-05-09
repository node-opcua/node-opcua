/**
 * @module node-opcua-server-configuration-server
 */
import path from "node:path";

import chalk from "chalk";

import type { AddressSpace, UAServerConfiguration } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { DiskCertificateKeyPairProvider, type ICertificateKeyPairProvider } from "node-opcua-common";
import { type Certificate, split_der, exploreCertificateInfo } from "node-opcua-crypto/web";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { invalidateServerCertificateCache, type OPCUAServer, type OPCUAServerEndPoint } from "node-opcua-server";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { type ApplicationDescriptionOptions, ServerState } from "node-opcua-types";

import { installPushCertificateManagement } from "./push_certificate_manager_helpers.js";
import type { ActionQueue, PushCertificateManagerServerImpl } from "./push_certificate_manager_server_impl.js";

const debugLog = make_debugLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const warningLog = make_warningLog("ServerConfiguration");

/** Relative path from cert manager root to the leaf certificate PEM. */
const CERT_PEM_RELATIVE_PATH = "own/certs/certificate.pem";

export interface OPCUAServerPartial extends ICertificateKeyPairProvider {
    serverInfo?: ApplicationDescriptionOptions;
    serverCertificateManager: OPCUACertificateManager;
    certificateFile: string;
    privateKeyFile: string;
    engine: { addressSpace?: AddressSpace };
    createDefaultCertificate(): Promise<void>;
    setProvider(provider: ICertificateKeyPairProvider): void;
    invalidateCachedCertificates(): void;
}

async function onCertificateAboutToChange(server: OPCUAServer) {
    doDebug && debugLog(chalk.yellow(" onCertificateAboutToChange => Suspending End points"));
    await server.suspendEndPoints();
    doDebug && debugLog(chalk.yellow(" onCertificateAboutToChange => End points suspended"));
}

/**
 * onCertificateChange is called when the serverConfiguration notifies
 * that the server certificate and/or private key has changed.
 *
 * This function invalidates all cached certificates so that new
 * connections immediately serve the updated certificate.
 *
 * Channel teardown is deferred to the `applyChangesCompleted` event
 * so the ApplyChanges OPC-UA method can return its response before
 * the admin client's own channel is destroyed.
 */
async function onCertificateChange(server: OPCUAServer) {
    doDebug && debugLog("on CertificateChanged");
    invalidateServerCertificateCache(server);
}

/**
 * Deferred channel restart: called after the ApplyChanges method
 * response has been sent.  Shuts down all existing secure channels
 * (which forces clients to reconnect with the new cert) and resumes
 * the endpoints.
 */
async function onApplyChangesCompleted(server: OPCUAServer) {
    doDebug && debugLog(chalk.yellow(" onApplyChangesCompleted => shutting down channels"));
    await server.shutdownChannels();
    doDebug && debugLog(chalk.yellow(" onApplyChangesCompleted => channels shut down"));

    doDebug && debugLog(chalk.yellow(" onApplyChangesCompleted => resuming end points"));
    await server.resumeEndPoints();
    doDebug && debugLog(chalk.yellow(" onApplyChangesCompleted => end points resumed"));

    debugLog(chalk.yellow("channels have been closed -> client should reconnect "));
}

/**
 * Redirect the server's certificate provider to the cert manager's
 * paths, create a default certificate if none exists, and invalidate
 * cached secrets.
 */
async function install(this: OPCUAServerPartial): Promise<void> {
    doDebug && debugLog("install push certificate management", this.serverCertificateManager.rootDir);

    const certFile = path.join(this.serverCertificateManager.rootDir, CERT_PEM_RELATIVE_PATH);
    const keyFile = this.serverCertificateManager.privateKey;

    // Inject a new disk provider pointing at the cert manager's
    // paths. The server's certificateFile/privateKeyFile getters
    // now automatically return the new paths.
    this.setProvider(new DiskCertificateKeyPairProvider(certFile, keyFile));

    // Delegate to the base server's createDefaultCertificate() which
    // handles DNS (fqdn + hostname + configured), IPs (auto + configured),
    // proper subject via makeSubject(), mutex locking, and file checks.
    await this.createDefaultCertificate();

    // Invalidate any previously cached secrets so that
    // getCertificateChain() / getPrivateKey() will re-read from disk.
    this.invalidateCachedCertificates();
}

interface UAServerConfigurationEx extends UAServerConfiguration {
    $pushCertificateManager: PushCertificateManagerServerImpl;
}

export async function installPushCertificateManagementOnServer(server: OPCUAServer): Promise<void> {
    if (!server.engine || !server.engine.addressSpace) {
        throw new Error(
            "Server must have a valid address space. " +
            "You need to call installPushCertificateManagementOnServer after server has been initialized"
        );
    }
    await install.call(server as unknown as OPCUAServerPartial);

    // After install() injected a new DiskCertificateKeyPairProvider,
    // set the same provider on each endpoint so they all read from
    // the cert manager's paths.
    // Push certificate management is inherently disk-based.
    // Assert that the store is a disk-based OPCUACertificateManager.
    if (!(server.serverCertificateManager instanceof OPCUACertificateManager)) {
        throw new Error(
            "installPushCertificateManagementOnServer requires a" +
            " disk-based OPCUACertificateManager as" +
            " serverCertificateManager"
        );
    }
    const cm = server.serverCertificateManager;
    const certFile = path.join(cm.rootDir, CERT_PEM_RELATIVE_PATH);
    const keyFile = cm.privateKey;
    for (const endpoint of server.endpoints) {
        endpoint.setCertificateProvider(new DiskCertificateKeyPairProvider(certFile, keyFile));
    }

    await installPushCertificateManagement(server.engine.addressSpace, {
        applicationGroup: cm,
        userTokenGroup: server.userCertificateManager,

        applicationUri: server.serverInfo.applicationUri || "InvalidURI"
    });

    const serverConfiguration = server.engine.addressSpace.rootFolder.objects.server.getChildByName("ServerConfiguration");
    const serverConfigurationPriv = serverConfiguration as UAServerConfigurationEx;
    assert(serverConfigurationPriv.$pushCertificateManager);

    serverConfigurationPriv.$pushCertificateManager.on("CertificateAboutToChange", (actionQueue: ActionQueue) => {
        actionQueue.push(async (): Promise<void> => {
            doDebug && debugLog("CertificateAboutToChange Event received");
            await onCertificateAboutToChange(server);
            doDebug && debugLog("CertificateAboutToChange Event processed");
        });
    });
    serverConfigurationPriv.$pushCertificateManager.on("CertificateChanged", (actionQueue: ActionQueue) => {
        actionQueue.push(async (): Promise<void> => {
            doDebug && debugLog("CertificateChanged Event received");
            await onCertificateChange(server);
            doDebug && debugLog("CertificateChanged Event processed");
        });
    });

    serverConfigurationPriv.$pushCertificateManager.on("applyChangesCompleted", () => {
        // Fire-and-forget: schedule channel teardown + endpoint
        // resumption AFTER the method response is sent.
        setImmediate(async () => {
            try {
                await onApplyChangesCompleted(server);
            } catch (err) {
                errorLog("onApplyChangesCompleted error:", (err as Error).message);
            }
        });
    });

    // ── Install NoConfiguration certificate relaxation ─────────
    //
    // When the server is in NoConfiguration state (awaiting GDS
    // provisioning), relax certain certificate trust/CRL errors
    // so that the GDS client can connect and provision the server.
    //
    // This hook is ONLY installed when push certificate management
    // is active — bare servers are completely unaffected.
    installCertificateRelaxationHook(server);
}

// ── Certificate relaxation for NoConfiguration state ──────────

/**
 * Status codes that can be relaxed during NoConfiguration state.
 *
 * These represent "trust infrastructure not yet set up" situations
 * (missing issuers, missing CRLs) — NOT security violations
 * (revoked, expired, invalid).
 *
 * ### Why `BadCertificateUntrusted` MUST be included (SECURITY NOTE)
 *
 * In `NoConfiguration` the server's trust store is **empty** — no
 * trusted certificates and no CRLs exist yet.  A GDS client that
 * connects to provision the server will inevitably present a
 * certificate that is "untrusted" simply because nothing is trusted
 * yet.  Removing `BadCertificateUntrusted` from this list would make
 * it impossible for the GDS to connect, breaking the entire push
 * certificate management provisioning workflow (chicken-and-egg).
 *
 * **Security boundary:** this relaxation is ONLY active while the
 * server state is `ServerState.NoConfiguration`.  Once the server
 * transitions to `Running` (after successful provisioning) the
 * relaxation hook returns the original status code unchanged and
 * normal strict certificate validation applies.  The accepted
 * certificate is auto-trusted (see `autoTrustCertificateChain`)
 * so that subsequent connections succeed under normal validation.
 *
 * Errors that indicate an active security violation (revoked,
 * expired, invalid signature, wrong usage) are **never** relaxed,
 * even in `NoConfiguration`.
 */
function isRelaxableCertificateError(statusCode: StatusCode): boolean {
    return (
        StatusCodes.BadCertificateUntrusted.equals(statusCode) ||
        StatusCodes.BadCertificateRevocationUnknown.equals(statusCode) ||
        StatusCodes.BadCertificateIssuerRevocationUnknown.equals(statusCode) ||
        StatusCodes.BadCertificateChainIncomplete.equals(statusCode)
    );
}

/**
 * Auto-trust the client's leaf certificate during NoConfiguration.
 *
 * Only the **leaf** (chain[0]) is placed in the trusted store —
 * this is sufficient for the GDS client to reconnect after the
 * server transitions to Running (the PKI verifier short-circuits
 * to `Good` when the leaf itself is explicitly trusted).
 *
 * Issuer (CA) certificates from the chain are added to the
 * **issuers/** store for chain-building purposes, but they do
 * NOT become trust anchors.  This prevents a single provisioning
 * connection from unintentionally granting trust to every
 * certificate signed by the same CA.
 */
async function autoTrustCertificateChain(
    server: OPCUAServer,
    certificate: Certificate
): Promise<void> {
    let chain: Certificate[];
    try {
        chain = split_der(certificate);
    } catch (err) {
        warningLog(
            "[NoConfiguration] Cannot parse certificate chain for auto-trust:",
            (err as Error).message
        );
        return;
    }

    const cm = server.serverCertificateManager as unknown as OPCUACertificateManager;

    for (let i = 0; i < chain.length; i++) {
        const cert = chain[i];
        // Validate the DER structure before persisting.
        // Garbage data (e.g. zero-filled buffers) parses into tiny blobs
        // that are not valid X.509 certificates.
        try {
            exploreCertificateInfo(cert);
        } catch (err) {
            warningLog(
                "[NoConfiguration] Skipping invalid certificate in chain for auto-trust:",
                (err as Error).message
            );
            continue;
        }

        if (i === 0) {
            // Leaf certificate → trust explicitly
            try {
                await cm.trustCertificate(cert);
            } catch (err) {
                // ENOENT can happen if another concurrent call already
                // moved the cert from rejected to trusted.
                if ((err as Error & { code?: string }).code !== "ENOENT") {
                    warningLog(
                        "[NoConfiguration] Failed to auto-trust leaf certificate:",
                        (err as Error).message
                    );
                }
            }
        } else {
            // Issuer CA certificate → add to issuers/ (chain-building
            // only, does NOT establish a trust anchor)
            try {
                await cm.addIssuer(cert);
            } catch (err) {
                warningLog(
                    "[NoConfiguration] Failed to add issuer certificate:",
                    (err as Error).message
                );
            }
        }
    }
}

/**
 * Install the `onAdjustCertificateStatus` hook on every endpoint.
 *
 * When the server is in `ServerState.NoConfiguration`, the hook
 * relaxes trust/CRL errors so that a GDS client with a valid
 * full-chain certificate can connect and provision the server.
 *
 * The leaf certificate is auto-trusted so that after the server
 * transitions to Running, the same client is accepted by normal
 * validation.  Issuer CAs are placed in `issuers/` for chain
 * building but do not become trust anchors.
 */
function installCertificateRelaxationHook(server: OPCUAServer): void {
    const adjustCertificateStatus = async (
        statusCode: StatusCode,
        certificate: Certificate
    ): Promise<StatusCode> => {
        // Only relax in NoConfiguration state
        if (server.engine.getServerState() !== ServerState.NoConfiguration) {
            return statusCode;
        }

        // Only relax trust-infrastructure errors, NOT security errors
        if (!isRelaxableCertificateError(statusCode)) {
            return statusCode;
        }

        doDebug && warningLog(
            `[NoConfiguration] Relaxing certificate check:`,
            `${statusCode.toString()} → Good`,
            "(server is awaiting GDS provisioning)"
        );

        // Auto-trust the leaf certificate; issuer CAs go to issuers/
        await autoTrustCertificateChain(server, certificate);

        return StatusCodes.Good;
    };

    for (const endpoint of server.endpoints) {
        (endpoint as OPCUAServerEndPoint).onAdjustCertificateStatus = adjustCertificateStatus;
    }
}
