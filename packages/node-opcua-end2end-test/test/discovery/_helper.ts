import { once } from "events";
import path from "path";
import os from "os";
import fs from "fs";
import chalk from "chalk";
import "should";
import {
    assert,
    makeApplicationUrn,
    makeSubject,
    OPCUABaseServer,
    OPCUADiscoveryServer,
    OPCUAServer,
    RegisterServerMethod
} from "node-opcua";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { createServerCertificateManager } from "../../test_helpers/createServerCertificateManager";
import { wait } from "../../test_helpers/utils";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

export async function pause(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
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

    const certificateFile = path.join(serverCertificateManager.rootDir, "certificate_server" + name + ".pem");

    assert(!name.match(/urn:/));
    const applicationName = name;
    const applicationUri = makeApplicationUrn(os.hostname(), name);

    if (!fs.existsSync(certificateFile)) {
        await serverCertificateManager.createSelfSignedCertificate({
            applicationUri,
            dns: [os.hostname(), "localhost"],
            // dns: argv.alternateHostname ? [argv.alternateHostname, fqdn] : [fqdn],
            // ip: await getIpAddresses(),
            outputFile: certificateFile,
            subject: makeSubject(applicationName, os.hostname()),
            startDate: new Date(),
            validity: 365 * 10
        });
    }

    const server = new OPCUAServer({
        port,
        serverInfo: {
            applicationName,
            applicationUri,
            productUri: "LDS-" + name
        },

        discoveryServerEndpointUrl,
        registerServerMethod: RegisterServerMethod.LDS,

        certificateFile,
        serverCertificateManager,
    });
    server.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);

    server.on("serverRegistrationPending", () => {
        debugLog("on serverRegistrationPending event received on server " + server.getEndpointUrl());
    });
    server.on("serverRegistered", () => {
        debugLog("on serverRegistered event received on server " + server.getEndpointUrl());
    });
    server.on("serverRegistrationRenewed", () => {
        debugLog("on serverRegistrationRenewed event received on server " + server.getEndpointUrl());
    });
    server.on("serverUnregistered", () => {
        debugLog("on serverUnregistered event received on server " + server.getEndpointUrl());
    });
    return server;
}

export function ep(server: OPCUABaseServer) {
    const endpointUri = server.getEndpointUrl();
    return endpointUri;
}

export const tweak_registerServerManager_timeout = (server: OPCUAServer, timeout: number) => {
    Object.prototype.hasOwnProperty.call(server.registerServerManager, "timeout").should.eql(true);
    (server.registerServerManager as any).timeout = timeout;
}
export const startAndWaitForRegisteredToLDS = async (server: OPCUAServer) => {
    await server.start();
    await new Promise<void>((resolve, reject) => {
        const timeout = 5000;
        const timerId = setTimeout(() => reject(new Error(`startAndWaitForRegisteredToLDS: Server failed to register initially within ${timeout} ms.`)), timeout);
        server.once("serverRegistered", () => {
            debugLog("server registered");
            resolve();
        });
    });
}
export async function createDiscovery(port: number): Promise<OPCUADiscoveryServer> {

    assert(typeof port === "number", "expecting a port number");
    const serverCertificateManager = await createServerCertificateManager(port)

    const privateKeyFile = serverCertificateManager.privateKey;
    const certificateFile = path.join(serverCertificateManager.rootDir, "certificate_discovery_server.pem");

    const applicationUri = "urn:localhost:LDS-" + port;
    if (!fs.existsSync(certificateFile)) {
        await serverCertificateManager.createSelfSignedCertificate({
            applicationUri,
            dns: [os.hostname(), "localhost"],
            // dns: argv.alternateHostname ? [argv.alternateHostname, fqdn] : [fqdn],
            // ip: await getIpAddresses(),
            outputFile: certificateFile,
            subject: "/CN=Sterfive/DC=NodeOPCUA-LocalDiscoveryServer",

            startDate: new Date(),
            validity: 365 * 10
        });
    }

    const discoveryServer = new OPCUADiscoveryServer({
        port,
        serverInfo: {
            applicationUri,
            productUri: "LDS-" + port
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
    const ff = async function (): Promise<T> {
        if (doTrace) {
            // tslint:disable-next-line: no-console
            console.log("         * " + title);
        }
        try {
            return await func();
        }
        catch (err) {
            if (doDebug) {
                // tslint:disable-next-line: no-console
                console.log("         ! " + title);
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
            // tslint:disable-next-line: no-console
            console.log("         * " + title);
        }
        await func();
        if (doDebug) {
            // tslint:disable-next-line: no-console
            console.log("         ! " + title);
        }
    };
    await ff();
}


export async function waitUntilCondition(
    condition: () => Promise<boolean>,
    timeout: number,
    message: string
): Promise<void> {
    const t = Date.now();
    while (!await condition()) {
        await wait(100);
        const t2 = Date.now();
        if (t2 - t > timeout) {
            const msg = `wait_until_condition: Timeout  reached timeout=${timeout} ${message || ""}`;
            console.log("wait_until_condition", msg);
            throw new Error(msg);
        }
    }
}
