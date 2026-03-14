/**
 * @module node-opcua-server-configuration-server
 */
import fs from "node:fs";
import path from "node:path";

import chalk from "chalk";

import type { AddressSpace, UAServerConfiguration } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import type { OPCUACertificateManager } from "node-opcua-certificate-manager";
import type { ICertificateKeyPairProviderPriv } from "node-opcua-common";
import { readPrivateKey } from "node-opcua-crypto";
import { type Certificate, convertPEMtoDER, type PrivateKey, split_der } from "node-opcua-crypto/web";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { getFullyQualifiedDomainName, getIpAddresses } from "node-opcua-hostname";
import type { OPCUAServer, OPCUAServerEndPoint } from "node-opcua-server";
import type { ApplicationDescriptionOptions } from "node-opcua-types";

import { installPushCertificateManagement } from "./push_certificate_manager_helpers.js";
import type { ActionQueue, PushCertificateManagerServerImpl } from "./push_certificate_manager_server_impl.js";

// node 14 onward : import {  readFile } from "fs/promises";
const { readFile } = fs.promises;

const debugLog = make_debugLog("ServerConfiguration");
const errorLog = make_errorLog("ServerConfiguration");
const doDebug = checkDebugFlag("ServerConfiguration");

export interface OPCUAServerPartial extends ICertificateKeyPairProviderPriv {
    serverInfo?: ApplicationDescriptionOptions;
    serverCertificateManager: OPCUACertificateManager;
    privateKeyFile: string;
    certificateFile: string;
    $$certificate: null | Certificate;
    $$certificateChain: null | Certificate;
    $$privateKey: null | PrivateKey;
    engine: { addressSpace?: AddressSpace };
}

function getCertificate(this: OPCUAServerPartial): Certificate {
    if (!this.$$certificate) {
        const certificateChain = getCertificateChain.call(this);
        this.$$certificate = split_der(certificateChain)[0];
    }
    return this.$$certificate;
}

function getCertificateChain(this: OPCUAServerPartial): Certificate {
    if (!this.$$certificateChain) {
        throw new Error("internal Error. cannot find $$certificateChain");
    }
    return this.$$certificateChain;
}

function getPrivateKey(this: OPCUAServerPartial): PrivateKey {
    // c8 ignore next
    if (!this.$$privateKey) {
        throw new Error("internal Error. cannot find $$privateKey");
    }
    return this.$$privateKey;
}



/**
 *
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

    if (!this.$$privateKey) {
        this.$$privateKey = readPrivateKey(this.serverCertificateManager.privateKey);
    }

    if (!this.$$certificateChain) {
        const certificateFile = this.certificateFile;

        if (!fs.existsSync(certificateFile)) {
            // this is the first time server is launch
            // let's create a default self signed certificate with limited validity

            const fqdn = await getFullyQualifiedDomainName();
            const ipAddresses = await getIpAddresses();

            const applicationUri = (this.serverInfo ? this.serverInfo.applicationUri : null) || "uri:MISSING";

            const options = {
                applicationUri,

                dns: [fqdn],
                ip: ipAddresses,

                subject: `/CN=${applicationUri};/L=Paris`,

                startDate: new Date(),

                validity: 365 * 5, // five year

                /* */
                outputFile: certificateFile
            };

            doDebug && debugLog("creating self signed certificate", options);
            await this.serverCertificateManager.createSelfSignedCertificate(options);
        }
        const certificatePEM = await readFile(certificateFile, "utf8");

        this.$$certificateChain = convertPEMtoDER(certificatePEM);

        //  await this.serverCertificateManager.trustCertificate( this.$$certificateChain);
    }
}

function getCertificateChainEP(this: OPCUAServerEndPoint): Certificate {
    const certificateFile = path.join(this.certificateManager.rootDir, "own/certs/certificate.pem");
    const certificatePEM = fs.readFileSync(certificateFile, "utf8");
    const $$certificateChain = convertPEMtoDER(certificatePEM);
    return $$certificateChain;
}

function getPrivateKeyEP(this: OPCUAServerEndPoint): PrivateKey {
    const privateKey = readPrivateKey(this.certificateManager.privateKey);
    return privateKey;
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
 * this function suspends all endpoint listeners and stop all existing channels
 * then start all endpoint listener
 *
 * @param server
 */
async function onCertificateChange(server: OPCUAServer) {
    doDebug && debugLog("on CertificateChanged");

    const _server = server as unknown as OPCUAServerPartial;

    _server.$$privateKey = readPrivateKey(server.serverCertificateManager.privateKey);
    const certificateFile = path.join(server.serverCertificateManager.rootDir, "own/certs/certificate.pem");
    const certificatePEM = fs.readFileSync(certificateFile, "utf8");

    const privateKeyFile = server.serverCertificateManager.privateKey;
    const privateKey = readPrivateKey(privateKeyFile);
    // also reread the private key

    _server.$$certificateChain = convertPEMtoDER(certificatePEM);
    _server.$$privateKey = privateKey;
    // note : $$certificate will be reconstructed on demand
    _server.$$certificate = split_der(_server.$$certificateChain)[0];

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

interface UAServerConfigurationEx extends UAServerConfiguration {
    $pushCertificateManager: PushCertificateManagerServerImpl;
}

type OPCUAServerEndPointEx = typeof OPCUAServerEndPoint & {
    _certificateChain: Buffer | null;
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

    server.getCertificate = getCertificate;
    server.getCertificateChain = getCertificateChain;
    server.getPrivateKey = getPrivateKey;

    for (const endpoint of server.endpoints) {
        const endpointPriv: OPCUAServerEndPointEx = endpoint as unknown as OPCUAServerEndPointEx;
        endpointPriv._certificateChain = null;
        endpointPriv._privateKey = null;

        endpoint.getCertificateChain = getCertificateChainEP;
        endpoint.getPrivateKey = getPrivateKeyEP;

        for (const e of endpoint.endpointDescriptions()) {
            Object.defineProperty(e, "serverCertificate", {
                get: () => endpoint.getCertificate(),
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
