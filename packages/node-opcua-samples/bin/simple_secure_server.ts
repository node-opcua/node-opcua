#!/usr/bin/env ts-node
/* eslint no-process-exit: 0 */
// tslint:disable:no-console
import * as chalk from "chalk";
import * as path from "path";
import * as yargs from "yargs";
import * as os from "os";

import { makeApplicationUrn, MessageSecurityMode, nodesets, OPCUAServer, SecurityPolicy, ServerSession } from "node-opcua";

Error.stackTraceLimit = Infinity;

function constructFilename(filename: string): string {
    return path.join(__dirname, "../", filename);
}

const userManager = {
    isValidUser: (userName: string, password: string) => {
        if (userName === "user1" && password === "password1") {
            return true;
        }
        if (userName === "user2" && password === "password2") {
            return true;
        }
        return false;
    }
};


async function main() {

    const argv = await yargs(process.argv)
        .wrap(132)

        .option("alternateHostname", {
            alias: "a",
            describe: "alternateHostname"
        })

        .option("port", {
            alias: "p",
            default: 26543
        })

        .option("silent", {
            alias: "s",
            default: false,
            describe: "silent - no trace"
        })
        .option("maxAllowedSessionNumber", {
            alias: "m",
            default: 10
        })
        .help(true).argv;


    const port = argv.port || 26543;
    // server_options.alternateHostname = argv.alternateHostname;

    const server_options = {
        securityPolicies: [SecurityPolicy.Basic128Rsa15, SecurityPolicy.Basic256],

        securityModes: [MessageSecurityMode.Sign, MessageSecurityMode.SignAndEncrypt],

        port,

        nodeset_filename: [nodesets.standard, nodesets.di],

        serverInfo: {
            applicationName: { text: "NodeOPCUA", locale: "en" },
            applicationUri: makeApplicationUrn(os.hostname(), "NodeOPCUA-SecureServer"),
            productUri: "NodeOPCUA-SecureServer",

            discoveryProfileUri: null,
            discoveryUrls: [],
            gatewayServerUri: null
        },

        buildInfo: {
            buildDate: new Date(),
            buildNumber: "1234"
        },

        userManager,

        isAuditing: false
    };

    process.title = "Node OPCUA Server on port : " + server_options.port;


    const server = new OPCUAServer(server_options);

    server.on("post_initialize", () => {
        /* empty */
    });

    console.log(chalk.yellow("  server PID          :"), process.pid);
    console.log(chalk.yellow("  silent              :"), argv.silent);

    await server.start();

    const endpointUrl = server.getEndpointUrl()!;
    console.log(chalk.yellow("  server on port      :"), chalk.cyan(server.endpoints[0].port.toString()));
    console.log(chalk.yellow("  endpointUrl         :"), chalk.cyan(endpointUrl));

    console.log(chalk.yellow("\n  server now waiting for connections. CTRL+C to stop"));

    if (argv.silent) {
        console.log("silent");
        console.log = (...args: [any?, ...any[]]) => {
            /* silent */
        };
    }

    server.on("create_session", (session: ServerSession) => {
        console.log(" SESSION CREATED");
        console.log(chalk.cyan("    client application URI: "), session.clientDescription!.applicationUri);
        console.log(chalk.cyan("        client product URI: "), session.clientDescription!.productUri);
        console.log(chalk.cyan("   client application name: "), session.clientDescription!.applicationName.toString());
        console.log(chalk.cyan("   client application type: "), session.clientDescription!.applicationType.toString());
        console.log(chalk.cyan("              session name: "), session.sessionName ? session.sessionName.toString() : "<null>");
        console.log(chalk.cyan("           session timeout: "), session.sessionTimeout);
        console.log(chalk.cyan("                session id: "), session.nodeId);
    });

    server.on("session_closed", (session: ServerSession, reason: string) => {
        console.log(" SESSION CLOSED :", reason);
        console.log(chalk.cyan("              session name: "), session.sessionName ? session.sessionName.toString() : "<null>");
    });

    process.on("SIGINT", async () => {
        // only work on linux apparently
        console.error(chalk.red.bold(" Received server interruption from user "));
        console.error(chalk.red.bold(" shutting down ..."));
        await server.shutdown(1000);
        console.error(chalk.red.bold(" shot down ..."));
        process.exit(1);
    });
}
main();
