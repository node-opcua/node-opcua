/**
 * @module node-opcua-server-configuration-server
 */
import fs from "node:fs";
import path from "node:path";

import chalk from "chalk";

import type { AddressSpace, UAServerConfiguration } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import type { OPCUACertificateManager } from "node-opcua-certificate-manager";
import { type ICertificateKeyPairProvider, invalidateCachedSecrets } from "node-opcua-common";
import { readPrivateKey } from "node-opcua-crypto";
import { type Certificate, combine_der, convertPEMtoDER, type PrivateKey, split_der } from "node-opcua-crypto/web";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { getFullyQualifiedDomainName, getIpAddresses } from "node-opcua-hostname";
import type { OPCUAServer, OPCUAServerEndPoint } from "node-opcua-server";
import type { ApplicationDescriptionOptions } from "node-opcua-types";

import { installPushCertificateManagement } from "./push_certificate_manager_helpers.js";
import type { ActionQueue, PushCertificateManagerServerImpl } from "./push_certificate_manager_server_impl.js";

const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");

export interface OPCUAServerPartial extends ICertificateKeyPairProvider {
    serverInfo?: ApplicationDescriptionOptions;
    serverCertificateManager: OPCUACertificateManager;
    privateKeyFile: string;
    certificateFile: string;
    engine: { addressSpace?: AddressSpace };
}

function getCertificateChainEP(this: OPCUAServerEndPoint): Certificate[] {
    const certificateFile = path.join(this.certificateManager.rootDir, "own/certs/certificate.pem");
    const certificatePEM = fs.readFileSync(certificateFile, "utf8");
    return split_der(convertPEMtoDER(certificatePEM));
}

function getPrivateKeyEP(this: OPCUAServerEndPoint): PrivateKey {
    return readPrivateKey(this.certificateManager.privateKey);
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
 * This function invalidates the cached secrets so that the next
 * getCertificate() / getPrivateKey() call re-reads from disk,
 * then shuts down all channels and resumes endpoints.
 *
 * @param server
 */
async function onCertificateChange(server: OPCUAServer) {
    doDebug && debugLog("on CertificateChanged");

    // Invalidate the cached certificate chain and private key.
    // The SecretHolder will re-read from disk on next access.
    invalidateCachedSecrets(server);

    setTimeout(async () => {
        try {
            doDebug && debugLog(chalk.yellow(" onCertificateChange => shutting down channels"));
            await server.shutdownChannels();
            doDebug && debugLog(chalk.yellow(" onCertificateChange => channels shut down"));

            doDebug && debugLog(chalk.yellow(" onCertificateChange => resuming end points"));
            await server.resumeEndPoints();
            doDebug && debugLog(chalk.yellow(" onCertificateChange => end points resumed"));

            debugLog(chalk.yellow("channels have been closed -> client should reconnect "));
        } catch (err) {
            errorLog("Error in CertificateChanged handler ", (err as Error).message);
            debugLog("err = ", err);
        }
    }, 2000);
}

/**
 * Install push certificate management on the server.
 *
 * This redirects `getCertificate`, `getCertificateChain` and
 * `getPrivateKey` to read from the serverCertificateManager's
 * PEM files, and wires up the push certificate management
 * address-space nodes.
 */
async function install(this: OPCUAServerPartial): Promise<void> {
    doDebug && debugLog("install push certificate management", this.serverCertificateManager.rootDir);

    Object.defineProperty(this, "privateKeyFile", {
        get: () => this.serverCertificateManager.privateKey,
        configurable: true
    });
    Object.defineProperty(this, "certificateFile", {
        get: () => path.join(this.serverCertificateManager.rootDir, "own/certs/certificate.pem"),
        configurable: true
    });

    const certificateFile = this.certificateFile;
    if (!fs.existsSync(certificateFile)) {
        // this is the first time server is launched
        // let's create a default self signed certificate with limited validity
        const fqdn = getFullyQualifiedDomainName();
        const ipAddresses = getIpAddresses();

        const applicationUri = (this.serverInfo ? this.serverInfo.applicationUri : null) || "uri:MISSING";

        const options = {
            applicationUri,
            dns: [fqdn],
            ip: ipAddresses,
            subject: `/CN=${applicationUri};/L=Paris`,
            startDate: new Date(),
            validity: 365 * 5, // five years
            outputFile: certificateFile
        };

        doDebug && debugLog("creating self signed certificate", options);
        await this.serverCertificateManager.createSelfSignedCertificate(options);
    }

    // Invalidate any previously cached secrets so that
    // getCertificateChain() / getPrivateKey() will re-read from disk.
    invalidateCachedSecrets(this);
}

interface UAServerConfigurationEx extends UAServerConfiguration {
    $pushCertificateManager: PushCertificateManagerServerImpl;
}

type OPCUAServerEndPointEx = typeof OPCUAServerEndPoint & {
    _certificateChain: Certificate[] | null;
    _privateKey: PrivateKey | null;
};

export async function installPushCertificateManagementOnServer(server: OPCUAServer): Promise<void> {
    if (!server.engine || !server.engine.addressSpace) {
        throw new Error(
            "Server must have a valid address space." +
                "you need to call installPushCertificateManagementOnServer after server has been initialized"
        );
    }
    await install.call(server as unknown as OPCUAServerPartial);

    for (const endpoint of server.endpoints) {
        const endpointPriv: OPCUAServerEndPointEx = endpoint as unknown as OPCUAServerEndPointEx;
        endpointPriv._certificateChain = null;
        endpointPriv._privateKey = null;

        endpoint.getCertificateChain = getCertificateChainEP;
        endpoint.getPrivateKey = getPrivateKeyEP;

        for (const e of endpoint.endpointDescriptions()) {
            Object.defineProperty(e, "serverCertificate", {
                get: () => combine_der(endpoint.getCertificateChain()),
                configurable: true
            });
        }
    }

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
