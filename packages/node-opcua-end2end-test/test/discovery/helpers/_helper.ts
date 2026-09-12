import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import chalk from "chalk";

import {
    assert,
    makeApplicationUrn,
    makeSubject,
    type OPCUABaseServer,
    type OPCUACertificateManager,
    OPCUADiscoveryServer,
    type OPCUADiscoveryServerOptions,
    OPCUAServer,
    RegisterServerMethod
} from "node-opcua";
import { publicKeyAndPrivateKeyMatches, readCertificate, readCertificateChain } from "node-opcua-crypto";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import "should";

import { createServerCertificateManager } from "../../../test_helpers/createServerCertificateManager.js";
import { stepLog, wait } from "../../../test_helpers/utils.js";
import type { TestHarness } from "./harness.js";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");
const { yellow, cyan } = chalk;

export const pause = wait;

/**
 * Create `certificateFile` as a self-signed certificate for the store's private key, unless a
 * matching one already exists.
 *
 * The stores under `os.tmpdir()/node-opcua-tmp/server<port>` persist across test runs while their
 * private key can be regenerated (store layout change, wiped `own/` folder, ...). A certificate left
 * over from a previous run then no longer matches the key and `OPCUAServer.initializeCM()` fails
 * with NODE-OPCUA-E01 for that name only, which showed up as a "random" failure in the
 * frequent-restart tests (DISCO4-J) once earlier tests had consumed the fresh names.
 */
async function ensureSelfSignedCertificate(
    certificateManager: OPCUACertificateManager,
    certificateFile: string,
    params: { applicationUri: string; subject: string }
): Promise<void> {
    if (fs.existsSync(certificateFile)) {
        const privateKey = await certificateManager.getPrivateKey();
        if (publicKeyAndPrivateKeyMatches(readCertificate(certificateFile), privateKey)) {
            return;
        }
        debugLog(`stale certificate ${certificateFile} does not match the store private key: recreating it`);
        fs.unlinkSync(certificateFile);
    }
    await certificateManager.createSelfSignedCertificate({
        applicationUri: params.applicationUri,
        dns: [os.hostname(), "localhost"],
        outputFile: certificateFile,
        subject: params.subject,
        startDate: new Date(),
        validity: 365 * 10
    });
}

export async function createDiscovery(port: number): Promise<OPCUADiscoveryServer> {
    assert(typeof port === "number", "expecting a port number");
    // a previous LDS on this port may still be releasing its socket
    await waitUntilPortIsFree(port);
    const serverCertificateManager = await createServerCertificateManager(port);

    const certificateFile = path.join(serverCertificateManager.rootDir, "certificate_discovery_server.pem");

    const applicationUri = `urn:localhost:LDS-${port}`;
    await ensureSelfSignedCertificate(serverCertificateManager, certificateFile, {
        applicationUri,
        subject: "/CN=Sterfive/DC=NodeOPCUA-LocalDiscoveryServer"
    });

    const discoveryServer = new OPCUADiscoveryServer({
        port,
        serverInfo: {
            applicationUri,
            productUri: `LDS-${port}`
        },

        certificateFile,
        serverCertificateManager
    });
    return discoveryServer;
}

export async function startDiscovery(port: number): Promise<OPCUADiscoveryServer> {
    const discoveryServer = await createDiscovery(port);
    await discoveryServer.start();
    return discoveryServer;
}

/**
 * Wait until nothing holds `port` any more.
 *
 * `OPCUAServer.shutdown()` resolves before the operating system has released the listening
 * socket, so a test that shuts an LDS down and immediately starts another one on the same
 * port races that release. It is a race, so it passed on one Node version and failed on the
 * other with EADDRINUSE, which reads as an unrelated CI flake.
 *
 * Probing with a throwaway listener asks the only question that matters: can this port be
 * bound right now.
 */
export async function waitUntilPortIsFree(port: number, timeout = 10000): Promise<void> {
    const deadline = Date.now() + timeout;
    for (;;) {
        const free = await new Promise<boolean>((resolve) => {
            const probe = net.createServer();
            probe.once("error", () => resolve(false));
            probe.once("listening", () => probe.close(() => resolve(true)));
            probe.listen(port);
        });
        if (free) {
            return;
        }
        if (Date.now() >= deadline) {
            throw new Error(`waitUntilPortIsFree: port ${port} is still in use after ${timeout} ms`);
        }
        await wait(50);
    }
}

export const makeDiscoveryServer = async (
    port_discovery: number,
    test: TestHarness,
    options?: Partial<OPCUADiscoveryServerOptions>
) => {
    // the previous LDS on this port may still be releasing its socket
    await waitUntilPortIsFree(port_discovery);

    const discoveryServer = new OPCUADiscoveryServer({
        ...options,
        port: port_discovery,
        serverCertificateManager: test.discoveryServerCertificateManager
    });

    discoveryServer.on("onRegisterServer", (server, firstTime) => {
        stepLog(yellow("LDS: Registering server    ", server.productUri, server.isOnline, "firstTime = ", firstTime));
    });
    discoveryServer.on("onUnregisterServer", (server, forced) => {
        stepLog(cyan("LDS: Unregistering server  ", server.productUri, server.isOnline, "force?= ", forced));
    });

    await discoveryServer.initializeCM();

    stepLog(` Discovery LDS will be on port ${port_discovery}`);
    return discoveryServer;
};

export async function addServerCertificateToTrustedCertificateInDiscoveryServer(
    server: OPCUAServer,
    discoveryServer: OPCUADiscoveryServer
) {
    const filename = server.certificateFile;
    fs.existsSync(filename).should.eql(true, ` the server certificate file ${filename} should exist`);
    const certificateChain = readCertificateChain(filename);
    const firstCertificate = certificateChain[0];
    await discoveryServer.serverCertificateManager.trustCertificate(firstCertificate);
}

/**
 *
 * @param discoveryEndpointUrl
 * @param port
 * @param name
 */
export async function createAndStartServer(discoveryEndpointUrl: string, port: number, name: string): Promise<OPCUAServer> {
    const server = await createServerThatRegistersItselfToTheDiscoveryServer(discoveryEndpointUrl, port, name);
    /* no await here on purpose */ server.start();
    // server registration takes place in parallel and should be checked independently
    await once(server, "serverRegistered");
    await pause(100);
    return server;
}
export async function createServerThatRegistersItselfToTheDiscoveryServer(
    discoveryServerEndpointUrl: string,
    port: number,
    name: string
): Promise<OPCUAServer> {
    const serverCertificateManager = await createServerCertificateManager(port);

    const certificateFile = path.join(serverCertificateManager.rootDir, `certificate_server${name}.pem`);

    assert(!name.match(/urn:/));
    const applicationName = name;
    const applicationUri = makeApplicationUrn(os.hostname(), name);

    await ensureSelfSignedCertificate(serverCertificateManager, certificateFile, {
        applicationUri,
        subject: makeSubject(applicationName, os.hostname())
    });

    const server = new OPCUAServer({
        port,
        serverInfo: {
            applicationName,
            applicationUri,
            productUri: `LDS-${name}`
        },

        discoveryServerEndpointUrl,
        registerServerMethod: RegisterServerMethod.LDS,

        certificateFile,
        serverCertificateManager
    });
    server.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);

    server.on("serverRegistrationPending", () => {
        debugLog(`on serverRegistrationPending event received on server ${server.getEndpointUrl()}`);
    });
    server.on("serverRegistered", () => {
        debugLog(`on serverRegistered event received on server ${server.getEndpointUrl()}`);
    });
    server.on("serverRegistrationRenewed", () => {
        debugLog(`on serverRegistrationRenewed event received on server ${server.getEndpointUrl()}`);
    });
    server.on("serverUnregistered", () => {
        debugLog(`on serverUnregistered event received on server ${server.getEndpointUrl()}`);
    });
    return server;
}

export function ep(server: OPCUABaseServer) {
    const endpointUri = server.getEndpointUrl();
    return endpointUri;
}

export const tweak_registerServerManager_timeout = (server: OPCUAServer, timeout: number) => {
    Object.hasOwn(server.registerServerManager || {}, "timeout").should.eql(true);
    (server.registerServerManager as unknown as { timeout: number }).timeout = timeout;
};
export const startAndWaitForRegisteredToLDS = async (server: OPCUAServer) => {
    console.log("starting server ", server.serverInfo.applicationUri);
    await server.start();
    await new Promise<void>((resolve, reject) => {
        const timeout = 10_000;

        const timerId = setTimeout(
            () => reject(new Error(`startAndWaitForRegisteredToLDS: Server failed to register initially within ${timeout} ms.`)),
            timeout
        );
        server.once("serverRegistered", () => {
            if (timerId) {
                clearTimeout(timerId);
            }
            console.log("server started and registered to the LDS");
            resolve();
        });
    });
};

const doTrace = doDebug || process.env.TRACE;

export type FF<T> = () => Promise<T>;
// add the tcp/ip endpoint with no security
export function f<T>(func: FF<T>): FF<T> {
    const title = func.name
        .replace(/_/g, " ")
        .replace(/^bound /, "")
        .replace("given ", chalk.green("**GIVEN** "))
        .replace("when ", chalk.green("**WHEN** "))
        .replace("then ", chalk.green("**THEN** "));
    const ff = async (): Promise<T> => {
        if (doTrace) {
            console.log(`         * ${title}`);
        }
        try {
            return await func();
        } catch (err) {
            if (doDebug) {
                console.log(`         ! ${title}`);
            }
            throw err;
        }
    };
    return ff;
}

export async function fa(title: string, func: () => Promise<void>): Promise<void> {
    title = title
        .replace(/_/g, " ")
        .replace(/^bound /, "")
        .replace("given ", chalk.green("**GIVEN** "))
        .replace("when ", chalk.green("**WHEN** "))
        .replace("then ", chalk.green("**THEN** "));

    const ff = async () => {
        if (doTrace) {
            console.log(`         * ${title}`);
        }
        await func();
        if (doDebug) {
            console.log(`         ! ${title}`);
        }
    };
    await ff();
}
