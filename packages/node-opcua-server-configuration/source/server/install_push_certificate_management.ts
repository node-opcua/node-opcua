/**
 * @module node-opcua-server-configuration-server
 */
import path from "node:path";

import chalk from "chalk";

import type { AddressSpace, UAServerConfiguration } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import type { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { type ICertificateKeyPairProvider, invalidateCachedSecrets } from "node-opcua-common";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { type OPCUAServer, invalidateServerCertificateCache } from "node-opcua-server";
import type { ApplicationDescriptionOptions } from "node-opcua-types";

import { installPushCertificateManagement } from "./push_certificate_manager_helpers.js";
import type { ActionQueue, PushCertificateManagerServerImpl } from "./push_certificate_manager_server_impl.js";

const debugLog = make_debugLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");

/** Relative path from cert manager root to the leaf certificate PEM. */
const CERT_PEM_RELATIVE_PATH = "own/certs/certificate.pem";

export interface OPCUAServerPartial extends ICertificateKeyPairProvider {
    serverInfo?: ApplicationDescriptionOptions;
    serverCertificateManager: OPCUACertificateManager;
    privateKeyFile: string;
    certificateFile: string;
    engine: { addressSpace?: AddressSpace };
    createDefaultCertificate(): Promise<void>;
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
 * This function invalidates all cached certificates so that the next
 * getCertificate() / getPrivateKey() call re-reads from disk,
 * then waits briefly for in-flight requests to complete before
 * shutting down channels and resuming endpoints.
 */
async function onCertificateChange(server: OPCUAServer) {
    doDebug && debugLog("on CertificateChanged");

    invalidateServerCertificateCache(server);

    // Allow a grace period for in-flight OPC UA requests to complete
    // before tearing down secure channels.
    const gracePeriodMs = 2000;
    await new Promise<void>((resolve) => setTimeout(resolve, gracePeriodMs));

    doDebug && debugLog(chalk.yellow(" onCertificateChange => shutting down channels"));
    await server.shutdownChannels();
    doDebug && debugLog(chalk.yellow(" onCertificateChange => channels shut down"));

    doDebug && debugLog(chalk.yellow(" onCertificateChange => resuming end points"));
    await server.resumeEndPoints();
    doDebug && debugLog(chalk.yellow(" onCertificateChange => end points resumed"));

    debugLog(chalk.yellow("channels have been closed -> client should reconnect "));
}

/**
 * Redirect the server's `certificateFile` and `privateKeyFile`
 * properties to the cert manager's paths, create a default
 * certificate if none exists, and invalidate cached secrets.
 */
async function install(this: OPCUAServerPartial): Promise<void> {
    doDebug && debugLog("install push certificate management", this.serverCertificateManager.rootDir);

    Object.defineProperty(this, "privateKeyFile", {
        get: () => this.serverCertificateManager.privateKey,
        configurable: true,
        enumerable: true
    });
    Object.defineProperty(this, "certificateFile", {
        get: () => path.join(this.serverCertificateManager.rootDir, CERT_PEM_RELATIVE_PATH),
        configurable: true,
        enumerable: true
    });

    // Delegate to the base server's createDefaultCertificate() which
    // handles DNS (fqdn + hostname + configured), IPs (auto + configured),
    // proper subject via makeSubject(), mutex locking, and file checks.
    await this.createDefaultCertificate();

    // Invalidate any previously cached secrets so that
    // getCertificateChain() / getPrivateKey() will re-read from disk.
    invalidateCachedSecrets(this);
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

    // After install() redirected certificateFile / privateKeyFile,
    // the SecretHolder(this) in each endpoint already follows the
    // new paths. Just invalidate their cached values so the next
    // access re-reads from the cert manager's files.
    invalidateServerCertificateCache(server);

    await installPushCertificateManagement(server.engine.addressSpace, {
        applicationGroup: server.serverCertificateManager,
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
}
