/**
 * @module node-opcua-server-configuration-server
 */
import fs from "fs";
import os from "os";
import path from "path";

import { types } from "util";
import chalk from "chalk";

import { UAServerConfiguration, AddressSpace } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { OPCUACertificateManager } from "node-opcua-certificate-manager";
import {
    Certificate,
    convertPEMtoDER,
    makeSHA1Thumbprint,
    PrivateKey,
    split_der
} from "node-opcua-crypto/web";
import { readPrivateKey } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { getFullyQualifiedDomainName } from "node-opcua-hostname";
import { ICertificateKeyPairProviderPriv } from "node-opcua-common";
import { OPCUAServer, OPCUAServerEndPoint } from "node-opcua-server";
import { ApplicationDescriptionOptions } from "node-opcua-types";

import { installPushCertificateManagement } from "./push_certificate_manager_helpers";
import { ActionQueue, PushCertificateManagerServerImpl } from "./push_certificate_manager_server_impl";

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
    return this.$$certificate!;
}

function getCertificateChain(this: OPCUAServerPartial): Certificate {
    if (!this.$$certificateChain) {
        throw new Error("internal Error. cannot find $$certificateChain");
    }
    return this.$$certificateChain;
}

function getPrivateKey(this: OPCUAServerPartial): PrivateKey {
    // istanbul ignore next
    if (!this.$$privateKey) {
        throw new Error("internal Error. cannot find $$privateKey");
    }
    return this.$$privateKey;
}

async function getIpAddresses(): Promise<string[]> {
    const ipAddresses: string[] = [];
    const netInterfaces = os.networkInterfaces();
    for (const interfaceName of Object.keys(netInterfaces)) {
        if (!netInterfaces[interfaceName]) {
            continue;
        }
        for (const interFace of netInterfaces[interfaceName]!) {
            if ("IPv4" !== interFace.family || interFace.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                continue;
            }
            ipAddresses.push(interFace.address);
        }
    }
    return ipAddresses;
}

/**
 *
 */
async function install(this: OPCUAServerPartial): Promise<void> {
    debugLog("install push certificate management", this.serverCertificateManager.rootDir);

    (this as any).__defineGetter__("privateKeyFile", () => this.serverCertificateManager.privateKey);
    (this as any).__defineGetter__("certificateFile", () =>
        path.join(this.serverCertificateManager.rootDir, "own/certs/certificate.pem")
    );

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

            const applicationUri = (this.serverInfo ? this.serverInfo!.applicationUri! : null) || "uri:MISSING";

            const options = {
                applicationUri,

                dns: [fqdn],
                ip: ipAddresses,

                subject: "/CN=" + applicationUri + ";/L=Paris",

                startDate: new Date(),

                validity: 365 * 5, // five year

                /* */
                outputFile: certificateFile
            };

            debugLog("creating self signed certificate", options);
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
    const thumbprint = makeSHA1Thumbprint($$certificateChain);

    return $$certificateChain;
}

function getPrivateKeyEP(this: OPCUAServerEndPoint): PrivateKey {
    const privateKey = readPrivateKey(this.certificateManager.privateKey);
    return privateKey;
}

async function onCertificateAboutToChange(server: OPCUAServer) {
    debugLog(chalk.yellow(" onCertificateAboutToChange => Suspending End points"));
    await server.suspendEndPoints();
    debugLog(chalk.yellow(" onCertificateAboutToChange => End points suspended"));
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
    debugLog("on CertificateChanged");

    const _server = server as any as OPCUAServerPartial;

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
            debugLog(chalk.yellow(" onCertificateChange => shutting down channels"));
            await server.shutdownChannels();
            debugLog(chalk.yellow(" onCertificateChange => channels shut down"));

            debugLog(chalk.yellow(" onCertificateChange => resuming end points"));
            await server.resumeEndPoints();
            debugLog(chalk.yellow(" onCertificateChange => end points resumed"));

            debugLog(chalk.yellow("channels have been closed -> client should reconnect "));
        } catch (err) {
            if (types.isNativeError(err)) {
                errorLog("Error in CertificateChanged handler ", err.message);
            }
            debugLog("err = ", err);
        }
    }, 2000);
}

interface UAServerConfigurationEx extends UAServerConfiguration {
    $pushCertificateManager: PushCertificateManagerServerImpl;
}
export async function installPushCertificateManagementOnServer(server: OPCUAServer): Promise<void> {
    if (!server.engine || !server.engine.addressSpace) {
        throw new Error(
            "Server must have a valid address space." +
                "you need to call installPushCertificateManagementOnServer after server has been initialized"
        );
    }
    await install.call(server as any as OPCUAServerPartial);

    server.getCertificate = getCertificate;
    server.getCertificateChain = getCertificateChain;
    server.getPrivateKey = getPrivateKey;

    for (const endpoint of server.endpoints) {
        const endpointPriv = endpoint as any;
        endpointPriv._certificateChain = null;
        endpointPriv._privateKey = null;

        endpoint.getCertificateChain = getCertificateChainEP;
        endpoint.getPrivateKey = getPrivateKeyEP;

        for (const e of endpoint.endpointDescriptions()) {
            // e.serverCertificate = null;
            (e as any).__defineGetter__("serverCertificate", function (this: any) {
                return endpoint.getCertificate();
            });
        }
    }

    await installPushCertificateManagement(server.engine.addressSpace, {
        applicationGroup: server.serverCertificateManager,
        userTokenGroup: server.userCertificateManager,

        applicationUri: server.serverInfo.applicationUri! || "InvalidURI"
    });

    const serverConfiguration = server.engine.addressSpace.rootFolder.objects.server.getChildByName("ServerConfiguration")!;
    const serverConfigurationPriv = serverConfiguration as UAServerConfigurationEx;
    assert(serverConfigurationPriv.$pushCertificateManager);

    serverConfigurationPriv.$pushCertificateManager.on("CertificateAboutToChange", (actionQueue: ActionQueue) => {
        actionQueue.push(async (): Promise<void> => {
            debugLog("CertificateAboutToChange Event received");
            await onCertificateAboutToChange(server);
            debugLog("CertificateAboutToChange Event processed");
        });
    });
    serverConfigurationPriv.$pushCertificateManager.on("CertificateChanged", (actionQueue: ActionQueue) => {
        actionQueue.push(async (): Promise<void> => {
            debugLog("CertificateChanged Event received");
            await onCertificateChange(server);
            debugLog("CertificateChanged Event processed");
        });
    });
}
