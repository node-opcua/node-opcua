#!/usr/bin/env node
import os from "os";
import path from "path";
import fs from "fs";

import { assert, OPCUACertificateManager, OPCUADiscoveryServer, extractFullyQualifiedDomainName, makeApplicationUrn } from "node-opcua";
import { input, select } from "@inquirer/prompts";
import envPaths from "env-paths";
import { make_debugLog } from "node-opcua-debug";

const paths = envPaths("node-opcua-local-discovery-server");

import yargs from "yargs/yargs.js";

const configFolder = paths.config;
const pkiFolder = path.join(configFolder, "PKI");
const serverCertificateManager = new OPCUACertificateManager({
    automaticallyAcceptUnknownCertificate: true,
    rootFolder: pkiFolder,
    name: "PKI"
});
const debugLog = make_debugLog("LDS");

async function getIpAddresses() {
    const ipAddresses /*: string[] */= [];
    const networkInterfaces = os.networkInterfaces();
    for (const [interfaceName, interfaces] of Object.entries(networkInterfaces)) {
        let alias = 0;
        for (const iFace of interfaces || []) {
            if ("IPv4" !== iFace.family || iFace.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                continue;
            }
            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                // istanbul ignore next
                debugLog(interfaceName + ":" + alias, iFace.address);
                ipAddresses.push(iFace.address);
            } else {
                // this interface has only one ipv4 address
                // istanbul ignore next
                debugLog(interfaceName, iFace.address);
                ipAddresses.push(iFace.address);
            }
            ++alias;
        }
    }
    return ipAddresses;
}
const applicationUri = "";

const argv = yargs(process.argv)
    .wrap(132)

    .number("port")
    .describe("port", "port to listen to (default: 4840)")
    .default("port", 4840)

    .boolean("tolerant")
    .describe("tolerant", "automatically accept unknown registering server certificate")
    .default("tolerant", true)

    .boolean("force")
    .describe("force", "force recreation of LDS self-signed certification (taking into account alternateHostname) ")
    .default("force", false)

    .string("alternateHostname")
    .describe("alternateHostname ", "alternate hostname to use in certificate")
    .string("hostname")
    .describe("hostname", "the hostname")

    .string("applicationName")
    .describe("applicationName", "the application name")
    .default("applicationName", "NodeOPCUA-DiscoveryServer")

    .alias("a", "alternateHostname")
    .alias("n", "applicationName")
    .alias("p", "port")
    .alias("h", "hostname")
    .alias("f", "force")
    .alias("t", "tolerant")

    .help(true).argv/* as {
        port: number,
        tolerant: boolean,
        force: boolean,
        applicationName: string,
        hostname?: string,
        alternateHostname?: string
    }*/
   ;

const port = argv.port;
const automaticallyAcceptUnknownCertificate = argv.tolerant;
const force = argv.force;
const applicationName = argv.applicationName;
console.log("port                                    ", port);
console.log("automatically accept unknown certificate", automaticallyAcceptUnknownCertificate);
console.log("applicationName                         ", applicationName);

(async () => {
    try {
        const fqdn = process.env.HOSTNAME || argv.hostname || (await extractFullyQualifiedDomainName());
        const hostname = argv.hostname || fqdn;
        const alternateHostname = argv.alternateHostname || undefined;

        console.log("fqdn                                ", fqdn);
        console.log("hostname                            ", hostname);
        console.log("alternateHostname                   ", alternateHostname);
        const applicationUri = makeApplicationUrn(fqdn, argv.applicationName);

        await serverCertificateManager.initialize();

        const certificateFile = path.join(pkiFolder, "local_discovery_server_certificate.pem");
        const privateKeyFile = serverCertificateManager.privateKey;
        assert(fs.existsSync(privateKeyFile), "expecting private key");

        if (!fs.existsSync(certificateFile) || force) {
            console.log("Creating self-signed certificate", certificateFile);

            await serverCertificateManager.createSelfSignedCertificate({
                applicationUri,
                dns: argv.alternateHostname ? [argv.alternateHostname, fqdn] : [fqdn],
                ip: await getIpAddresses(),
                outputFile: certificateFile,
                subject: "/CN=Sterfive/DC=NodeOPCUA-LocalDiscoveryServer",
                startDate: new Date(),
                validity: 365 * 10
            });
        }
        assert(fs.existsSync(certificateFile));

        const discoveryServer = new OPCUADiscoveryServer({
            // register
            port,
            certificateFile,
            privateKeyFile,
            serverCertificateManager,
            serverInfo: {
                applicationUri
            },
            hostname,
            alternateHostname: argv.alternateHostname ? [argv.alternateHostname] : [],
            // noUserIdentityTokens: true
        });

        try {
            await discoveryServer.start();
        } catch (err) {
            console.log("Error , cannot start LDS ", err.message);
            console.log("Make sure that a LocalDiscoveryServer is not already running on port 4840");
            return;
        }
        console.log(discoveryServer.serverInfo.toString());
        console.log("discovery server started on port ", discoveryServer.endpoints[0].port);
        console.log("CTRL+C to stop");
        console.log("rejected Folder ", discoveryServer.serverCertificateManager.rejectedFolder);
        console.log("trusted  Folder ", discoveryServer.serverCertificateManager.trustedFolder);


        const commandPrompt = {
            type: 'list',
            name: 'direction',
            message: 'select a command?',
            choices: ['list servers', 'shutdown'],
        };

        while (true) {
            const answer = await select({
                choices: ['list servers', 'shutdown'],
                message: 'select a command?',
            });
            console.log("answer", answer);
            if (answer === "shutdown") {
                break;
            }
            displayRegisteredServersInfo(discoveryServer);
        }
        await discoveryServer.shutdown();
        console.log("discovery server stopped");
        process.exit(0);

    } catch (err) {
        console.log(err.message);
        console.log(err);
    }
})();

function displayRegisteredServersInfo(discoveryServer/*: OPCUADiscoveryServer*/) {
    console.log(discoveryServer.serverInfo.toString());
    // xx console.log(discoveryServer.endpoints[0]);

    {
        const servers = Object.keys(discoveryServer.registeredServers);
        console.log("number of registered servers : ", servers.length);

        for (const serverKey of servers) {
            const server = discoveryServer.registeredServers[serverKey];
            console.log("key =", serverKey);
            console.log(server.toString());
        }
    }
    if (discoveryServer.mDnsResponder) {

        const server2 = Object.keys(discoveryServer.mDnsResponder.registeredServers);
        console.log("number of mNDS registered servers : ", server2.length);
        for (const serverKey of server2) {
            const server = discoveryServer.mDnsResponder.registeredServers[serverKey];
            console.log("key =", serverKey);
            console.log(server.toString());
        }
    }
}