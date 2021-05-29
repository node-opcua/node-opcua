import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as chalk from "chalk";
import "should";
import {
    assert,
    ErrorCallback,
    makeApplicationUrn,
    makeSubject,
    OPCUABaseServer,
    OPCUACertificateManager,
    OPCUADiscoveryServer,
    OPCUAServer,
    RegisterServerMethod
} from "node-opcua";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
import { once } from "events";

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const configFolder = path.join(__dirname, "../../tmp");

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
    const pkiFolder = path.join(configFolder, "pki" + name);
    const serverCertificateManager = new OPCUACertificateManager({
        // keySize: 4096,
        automaticallyAcceptUnknownCertificate: true,
        name: "pki" + name,
        rootFolder: pkiFolder
    });
    await serverCertificateManager.initialize();
    const certificateFile = path.join(serverCertificateManager.rootDir, "certificate_server" + name + ".pem");

    assert(!name.match(/urn\:/));
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
        serverCertificateManager
    });
    server.discoveryServerEndpointUrl.should.eql(discoveryServerEndpointUrl);

    server.on("serverRegistrationPending", () => {
        debugLog("server serverRegistrationPending");
    });
    server.on("serverRegistered", () => {
        debugLog("server serverRegistered");
    });
    server.on("serverRegistrationRenewed", () => {
        debugLog("server serverRegistrationRenewed");
    });
    server.on("serverUnregistered", () => {
        debugLog("server serverUnregistered");
    });
    return server;
}

export function ep(server: OPCUABaseServer) {
    const endpointUri = server.getEndpointUrl();
    return endpointUri;
}

export async function createDiscovery(port: number): Promise<OPCUADiscoveryServer> {
    const serverCertificateManager = new OPCUACertificateManager({
        automaticallyAcceptUnknownCertificate: true,
        rootFolder: path.join(configFolder, "PKI-Discovery" + port)
    });
    await serverCertificateManager.initialize();

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

export type FF = (callback: ErrorCallback) => void;
// add the tcp/ip endpoint with no security
export function f(func: FF): FF {
    const title = func.name
        .replace(/_/g, " ")
        .replace(/^bound /,"")
        .replace("given ", chalk.green("**GIVEN** "))
        .replace("when ", chalk.green("**WHEN** "))
        .replace("then ", chalk.green("**THEN** "));
    const ff = function (callback: ErrorCallback) {
        if (doTrace) {
            // tslint:disable-next-line: no-console
            console.log("         * " + title);
        }
        func((err?: Error | null) => {
            if (doDebug) {
                // tslint:disable-next-line: no-console
                console.log("         ! " + title);
            }
            callback(err!);
        });
    };
    return ff;
}

export async function fa(title: string, func: () => Promise<void>): Promise<void> {
    title= title
        .replace(/_/g, " ")
        .replace(/^bound /,"")
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
