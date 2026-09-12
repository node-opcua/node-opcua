#!/usr/bin/env tsx
import { createRequire } from "node:module";

// `require` does not exist in an ES module. It is kept rather than replaced by import()
// because import() is async and resolves against the emitted .js, neither of which is
// safe to assume at a call site a tool has not read. Converting one by hand is fine.
const require = createRequire(import.meta.url);

import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";
import chalk from "chalk";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import {
    ApplicationType,
    coerceMessageSecurityMode,
    coerceSecurityPolicy,
    MessageSecurityMode,
    OPCUAClient,
    type OPCUAClientOptions,
    SecurityPolicy,
    UserTokenType
} from "node-opcua";
import { type Certificate, toPem } from "node-opcua-crypto";

const Table = require("easy-table");
const treeify = require("treeify");

const here = import.meta.dirname;

async function main() {
    // tsx bin/simple_client.ts --endpoint  opc.tcp://localhost:53530/OPCUA/SimulationServer --node "ns=5;s=Sinusoid1"
    const optionDefinitions: commandLineUsage.OptionDefinition[] = [
        { name: "endpoint", alias: "e", type: String, description: "the end point to connect to " },
        {
            name: "securityMode",
            alias: "s",
            type: String,
            defaultValue: "None",
            description: "the security mode (  None Sign SignAndEncrypt )"
        },
        {
            name: "securityPolicy",
            alias: "P",
            type: String,
            defaultValue: "None",
            description: `the policy mode : (${Object.keys(SecurityPolicy).join(" - ")})`
        },
        {
            name: "discovery",
            alias: "D",
            type: String,
            description: "specify the endpoint uri of discovery server (by default same as server endpoint uri)"
        }
    ];
    const sections: commandLineUsage.Section[] = [
        { header: "get_endpoints", content: "list the endpoints a server offers" },
        { header: "Options", optionList: optionDefinitions },
        { header: "Examples", content: ["get_endpoints  --endpoint opc.tcp://localhost:49230"] }
    ];
    const argv = commandLineArgs(optionDefinitions);

    const securityMode = coerceMessageSecurityMode(argv.securityMode);
    if (securityMode === MessageSecurityMode.Invalid) {
        throw new Error("Invalid Security mode");
    }

    const securityPolicy = coerceSecurityPolicy(argv.securityPolicy);
    if (securityPolicy === SecurityPolicy.Invalid) {
        throw new Error("Invalid securityPolicy");
    }

    console.log(chalk.cyan("securityMode        = "), securityMode.toString());
    console.log(chalk.cyan("securityPolicy      = "), securityPolicy.toString());

    const endpointUrl = argv.endpoint as string;

    if (!endpointUrl) {
        console.log(commandLineUsage(sections));
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
        if (types.isNativeError(err)) {
            console.log(" Error = ", err.message);
        }
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
        table.cell("endpoint", `${endpoint.endpointUrl}`);
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

        const certificate_filename = path.join(here, `../certificates/PKI/server_certificate${i}.pem`);

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
        for (const token of endpoint.userIdentityTokens || []) {
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
