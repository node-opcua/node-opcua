#!/usr/bin/env node
const os = require("os");
const path = require("path");
const fs = require("fs");
const yargs = require("yargs/yargs");

const {
    assert,
    OPCUACertificateManager,
    OPCUADiscoveryServer,
    extractFullyQualifiedDomainName,
    makeApplicationUrn
} = require("node-opcua");

// Create a new instance of vantage.
const Vorpal = require("vorpal");
const vorpal_repl = require("vorpal-repl");
const envPaths = require("env-paths");


const paths = envPaths("node-opcua-local-discovery-server");
const configFolder = paths.config;
const pkiFolder = path.join(configFolder, "PKI");
const serverCertificateManager = new OPCUACertificateManager({
    automaticallyAcceptUnknownCertificate: true,
    rootFolder: pkiFolder,
    name: "PKI"
});

async function getIpAddresses() {

    const ipAddresses = [];
    const interfaces = os.networkInterfaces();
    Object.keys(interfaces).forEach(function(interfaceName) {
        let alias = 0;

        interfaces[interfaceName].forEach((iFace) => {
            if ('IPv4' !== iFace.family || iFace.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }
            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                console.log(interfaceName + ':' + alias, iFace.address);
                ipAddresses.push(iFace.address);
            } else {
                // this interface has only one ipv4 address
                console.log(interfaceName, iFace.address);
                ipAddresses.push(iFace.address);
            }
            ++alias;
        });
    });
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
    .describe("alternateHostname ")

    .string("applicationName")
    .describe("applicationName", "the application name")
    .default("applicationName", "NodeOPCUA-DiscoveryServer")


    .alias("a", "alternateHostname")
    .alias("n", "applicationName")
    .alias("p", "port")
    .alias("f", "force")
    .alias("t", "tolerant")

    .help(true)
    .argv;

const port = argv.port;
const automaticallyAcceptUnknownCertificate = argv.tolerant;
const force = argv.force;
const applicationName = argv.applicationName;
console.log("port                                    ", port);
console.log("automatically accept unknown certificate", automaticallyAcceptUnknownCertificate);
console.log("applicationName                         ", applicationName);

(async () => {
    try {

        const fqdn = process.env.HOSTNAME || await extractFullyQualifiedDomainName();

        console.log("fqdn                                ", fqdn);
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
                validity: 365 * 10,
            })
        }
        assert(fs.existsSync(certificateFile));


        const discoveryServer = new OPCUADiscoveryServer({
            // register
            port,
            certificateFile,
            privateKeyFile,
            serverCertificateManager,
            automaticallyAcceptUnknownCertificate,
            serverInfo: {
                applicationUri
            }
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


        const vorpal = new Vorpal();
        vorpal
            .command("info")
            .description("display list of registered servers.")
            .action(function(args, callback) {

                this.log(discoveryServer.serverInfo.toString());
                // xx this.log(discoveryServer.endpoints[0]);

                {
                    const servers = Object.keys(discoveryServer.registeredServers);
                    this.log("number of registered servers : ", servers.length);

                    for (const serverKey of servers) {
                        const server = discoveryServer.registeredServers[serverKey];
                        this.log("key =", serverKey);
                        this.log(server.toString());
                    }
                }
                {
                    const server2 = Object.keys(discoveryServer.mDnsResponder.registeredServers);
                    this.log("number of mNDS registered servers : ", server2.length);
                    for (const serverKey of server2) {
                        const server = discoveryServer.mDnsResponder.registeredServers[serverKey];
                        this.log("key =", serverKey);
                        this.log(server.toString());
                    }
                }

                callback();
            });
        vorpal.delimiter("local-discovery-server$").use(vorpal_repl).show();

    }
    catch (err) {
        console.log(err.message);
        console.log(err);
    }
})();

