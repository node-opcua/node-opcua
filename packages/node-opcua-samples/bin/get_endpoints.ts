#!/usr/bin/env ts-node
// tslint:disable:no-console
import * as chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import * as yargs from "yargs";

import {
    ApplicationType,
    coerceMessageSecurityMode,
    coerceSecurityPolicy,
    MessageSecurityMode,
    OPCUAClient,
    OPCUAClientOptions,
    SecurityPolicy,
    UserTokenType
} from "node-opcua";
import { Certificate, toPem } from "node-opcua-crypto";

// tslint:disable:no-var-requires
const Table = require("easy-table");
const treeify = require("treeify");


async function main() {

    // ts-node bin/simple_client.ts --endpoint  opc.tcp://localhost:53530/OPCUA/SimulationServer --node "ns=5;s=Sinusoid1"
    const argv = await yargs(process.argv)
        .wrap(132)

        .option("endpoint", {
            alias: "e",
            demandOption: true,
            describe: "the end point to connect to "
        })
        .option("securityMode", {
            alias: "s",
            default: "None",
            describe: "the security mode (  None Sign SignAndEncrypt )"
        })
        .option("securityPolicy", {
            alias: "P",
            default: "None",
            describe: "the policy mode : (" + Object.keys(SecurityPolicy).join(" - ") + ")"
        })
        .option("discovery", {
            alias: "D",
            describe: "specify the endpoint uri of discovery server (by default same as server endpoint uri)"
        })
        .example("get_endpoints  --endpoint opc.tcp://localhost:49230", "").argv;

    const securityMode = coerceMessageSecurityMode(argv.securityMode!);
    if (securityMode === MessageSecurityMode.Invalid) {
        throw new Error("Invalid Security mode");
    }

    const securityPolicy = coerceSecurityPolicy(argv.securityPolicy!);
    if (securityPolicy === SecurityPolicy.Invalid) {
        throw new Error("Invalid securityPolicy");
    }

    console.log(chalk.cyan("securityMode        = "), securityMode.toString());
    console.log(chalk.cyan("securityPolicy      = "), securityPolicy.toString());

    const endpointUrl = argv.endpoint as string;

    if (!endpointUrl) {
        yargs.showHelp();
        process.exit(0);
    }
    const discoveryUrl = argv.discovery ? (argv.discovery as string) : endpointUrl;
    const optionsInitial: OPCUAClientOptions = {
        securityMode,
        securityPolicy,

        endpointMustExist: false,

        connectionStrategy: {
            initialDelay: 2000,
            maxDelay: 10 * 1000,
            maxRetry: 10
        },

        discoveryUrl
    };

    const client = OPCUAClient.create(optionsInitial);

    client.on("backoff", (retry: number, delay: number) => {
        console.log(chalk.bgWhite.yellow("backoff  attempt #"), retry, " retrying in ", delay / 1000.0, " seconds");
    });

    console.log(" connecting to ", chalk.cyan.bold(endpointUrl));
    console.log("    strategy", client.connectionStrategy);

    try {
        await client.connect(endpointUrl);
    } catch (err) {
        console.log(chalk.red(" Cannot connect to ") + endpointUrl);
        console.log(" Error = ", err.message);
        return;
    }

    const endpoints = await client.getEndpoints();

    if (argv.debug) {
        fs.writeFileSync("tmp/endpoints.log", JSON.stringify(endpoints, null, " "));
        console.log(treeify.asTree(endpoints, true));
    }

    const table = new Table();

    let serverCertificate: Certificate | undefined;

    let i = 0;
    for (const endpoint of endpoints) {
        table.cell("endpoint", endpoint.endpointUrl + "");
        table.cell("Application URI", endpoint.server.applicationUri);
        table.cell("Product URI", endpoint.server.productUri);
        table.cell("Application Name", endpoint.server.applicationName.text);
        table.cell("securityLevel", endpoint.securityLevel);
        table.cell("Security Mode", chalk.cyan(MessageSecurityMode[endpoint.securityMode].toString()));
        table.cell("securityPolicyUri", chalk.cyan(endpoint.securityPolicyUri));
        table.cell("Type", ApplicationType[endpoint.server.applicationType]);
        table.cell("certificate", "..." /*endpoint.serverCertificate*/);
        endpoint.server.discoveryUrls = endpoint.server.discoveryUrls || [];
        table.cell("discoveryUrls", endpoint.server.discoveryUrls.join(" - "));

        serverCertificate = endpoint.serverCertificate;

        const certificate_filename = path.join(__dirname, "../certificates/PKI/server_certificate" + i + ".pem");

        if (serverCertificate) {
            fs.writeFile(certificate_filename, toPem(serverCertificate, "CERTIFICATE"), () => {
                /**/
            });
        }
        table.newRow();
        i++;
    }
    console.log(table.toString());

    for (const endpoint of endpoints) {
        console.log(
            "Identify Token for : Security Mode=",
            chalk.cyan(MessageSecurityMode[endpoint.securityMode].toString()),
            " Policy=",
            chalk.cyan(endpoint.securityPolicyUri)
        );
        const table2 = new Table();
        for (const token of endpoint.userIdentityTokens!) {
            table2.cell("policyId", token.policyId);
            table2.cell("tokenType", UserTokenType[token.tokenType]);
            table2.cell("issuedTokenType", token.issuedTokenType);
            table2.cell("issuerEndpointUrl", token.issuerEndpointUrl);
            table2.cell("securityPolicyUri", token.securityPolicyUri);
            table2.newRow();
        }
        console.log(table2.toString());
    }
    await client.disconnect();
    console.log("success !!   ");
    process.exit(0);
}
main();
