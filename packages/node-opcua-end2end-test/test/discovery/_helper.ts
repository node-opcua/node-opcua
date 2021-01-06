import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as chalk from "chalk";
import "should";
import { ErrorCallback, OPCUABaseServer, OPCUACertificateManager, OPCUADiscoveryServer, OPCUAServer, RegisterServerMethod } from "node-opcua";
import { make_debugLog, checkDebugFlag } from "node-opcua-debug";
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const configFolder = path.join(__dirname, "../../tmp");
/**
 *
 * @param discoveryEndpointUrl
 * @param port
 * @param name
 */
export async function createAndStartServer(discoveryEndpointUrl: string, port: number, name: string): Promise<OPCUAServer> {
    const server = await createServerThatRegisterWithDiscoveryServer(discoveryEndpointUrl, port, name);
    /* no await here on purpose */ server.start();
    // server registration takes place in parallel and should be checked independently
    await new Promise((resolve) => server.on("serverRegistered", resolve));
    await new Promise((resolve) => setTimeout(resolve, 100));
    return server;
}
export async function createServerThatRegisterWithDiscoveryServer(
    discoveryServerEndpointUrl: string,
    port: number,
    name: string
): Promise<OPCUAServer> {
    const pkiFolder = path.join(configFolder, "pki" + name);
    const serverCertificateManager = new OPCUACertificateManager({
        // keySize: 4096,
        automaticallyAcceptUnknownCertificate: true,
        rootFolder: pkiFolder,
        name: "pki" + name
    });
    await serverCertificateManager.initialize();
    const privateKeyFile = serverCertificateManager.privateKey;
    const certificateFile = path.join(serverCertificateManager.rootDir, "certificate_server" + name + ".pem");

    const applicationUri = "urn:" + name;

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

    const server = new OPCUAServer({
        port,
        serverInfo: {
            applicationUri,
            productUri: "LDS-" + name
        },
        registerServerMethod: RegisterServerMethod.LDS,
        discoveryServerEndpointUrl,
        serverCertificateManager,
        privateKeyFile,
        certificateFile
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
        rootFolder: path.join(configFolder, "PKI-Discovery" + port),
        automaticallyAcceptUnknownCertificate: true
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
        serverCertificateManager,
        serverInfo: {
            applicationUri,
            productUri: "LDS-" + port
        },
        privateKeyFile,
        certificateFile
    });
    return discoveryServer;
}

export async function startDiscovery(port: number): Promise<OPCUADiscoveryServer> {
    const discoveryServer = await createDiscovery(port);
    await discoveryServer.start();
    return discoveryServer;
}


const doTrace =  doDebug || process.env.TRACE;

export type FF = (callback: ErrorCallback) => void;
// add the tcp/ip endpoint with no security
export function f(func: FF): FF {
    const title = func.name
        .replace(/_/g, " ")
        .replace("given ", chalk.green("**GIVEN** "))
        .replace("when ", chalk.green("**WHEN** "))
        .replace("then ", chalk.green("**THEN** "));
    const ff = function (callback: ErrorCallback) {
        if (doTrace) {
            console.log("         * " + title);
        }
        func((err?: Error| null) => {
            if (doDebug) {
                console.log("         ! " + title);
            }
            callback(err!);
        });
    };
    return ff;
}

export async function fa(title: string, func: () => Promise<void>): Promise<void> {
    title = title
        .replace(/_/g, " ")
        .replace("given ", chalk.green("**GIVEN** "))
        .replace("when ", chalk.green("**WHEN** "))
        .replace("then ", chalk.green("**THEN** "));

    const ff = async () => {
        if (doTrace) {
            console.log("         * " + title);
        }
        await func();
        if (doDebug) {
            console.log("         ! " + title);
        }
    };
    await ff();
}
