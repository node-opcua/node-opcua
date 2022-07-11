#!/usr/bin/env ts-node
/* eslint no-process-exit: 0 */
// tslint:disable:no-console
import * as path from "path";
import * as chalk from "chalk";

import { makeRoles, nodesets, OPCUACertificateManager, OPCUAServer, OPCUAServerOptions, WellKnownRoles } from "node-opcua";
import { CertificateManager } from "node-opcua-pki";
import { installPushCertificateManagement } from "node-opcua-server-configuration";
import * as yargs from "yargs";

const rootFolder = path.join(__dirname, "../../..");

import envPaths = require("env-paths");
const config = envPaths("node-opcua-default").config;
const pkiFolder = path.join(config, "PKI");

const certificateManager = new OPCUACertificateManager({
    automaticallyAcceptUnknownCertificate: true,
    name: "PKI",
    rootFolder: pkiFolder
});

const users = [
    {
        username: "user1",
        password: "password1",
        role: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin, WellKnownRoles.SecurityAdmin])
    },
    { username: "user2", password: "password2", role: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator]) }
];

const userManager = {
    isValidUser(username: string, password: string) {
        const uIndex = users.findIndex((x) => x.username === username);
        if (uIndex < 0) {
            return false;
        }
        if (users[uIndex].password !== password) {
            return false;
        }
        return true;
    },
    getUserRoles(username: string) {
        const uIndex = users.findIndex((x) => x.username === username);
        if (uIndex < 0) {
            return [];
        }
        const userRole = users[uIndex].role;
        return userRole;
    }
};

async function main() {
    const argv = await yargs.wrap(132).option("port", {
        alias: "p",
        default: "26543",
        describe: "port to listen"
    }).argv;

    const port = parseInt(argv.port, 10) || 26555;

    const serverOptions: OPCUAServerOptions = {
        port,

        nodeset_filename: [nodesets.standard],

        serverCertificateManager: certificateManager,
        userCertificateManager: certificateManager,

        userManager
    };

    process.title = "Node OPCUA Server on port : " + serverOptions.port;
    const tmpFolder = path.join(__dirname, "../certificates/myApp");

    const applicationGroup = new CertificateManager({
        location: tmpFolder
    });
    await applicationGroup.initialize();

    const server = new OPCUAServer(serverOptions);

    console.log(" Configuration rootdir =  ", server.serverCertificateManager.rootDir);
    console.log(chalk.yellow("  server PID          :"), process.pid);

    await server.initialize();

    const addressSpace = server.engine.addressSpace!;
    // to do: expose new nodeid here
    const ns = addressSpace.getNamespaceIndex("http://yourorganisation.org/my_data_type/");

    await installPushCertificateManagement(addressSpace, {
        applicationGroup: server.serverCertificateManager,
        userTokenGroup: server.userCertificateManager,
        applicationUri: server.serverInfo.applicationUri!
    });

    console.log("Certificate rejected folder ", server.serverCertificateManager.rejectedFolder);

    try {
        await server.start();
    } catch (err) {
        console.log(" Server failed to start ... exiting");
        process.exit(-3);
    }

    const endpointUrl = server.getEndpointUrl()!;

    console.log(chalk.yellow("  server on port      :"), chalk.cyan(server.endpoints[0].port.toString()));
    console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));
    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    process.once("SIGINT", async () => {
        // only work on linux apparently
        await server.shutdown(1000);
        console.log(chalk.red.bold(" shutting down completed "));
        process.exit(-1);
    });
}

main();
