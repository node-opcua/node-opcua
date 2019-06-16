// to launch in the documentation folder
import * as path from "path";
import * as fs from "fs";
import { Application } from "typedoc";

// @ts-ignore
const app = new Application({
    experimentalDecorators: false,
    logger: "console",
    mode: "modules",
    module: "CommonJS",
    target: "ES6",

    gaID: "UA-25438821-3",
    gaSite: "node-opcua.github.io"
});

let nodeopcuaModules = [
    "types",
    "address-space",
    "aggregates",
    "assert",
    "basic-types",
    "benchmarker",
    "binary-stream",
    "buffer-utils",
    "certificate-manager",
    "client",
    "client-crawler",
    "client-proxy",
    "common",
    "constants",
    // "convert-nodeset-to-javascript",
    "data-access",
    "data-model",
    "data-value",
    "date-time",
    "debug",
    "enum",
    "extension-object",
    "factory",
    "file-transfer",
    "generator",
    "guid",
    "hostname",
    // "leak"
    // "local-discovery-server",
    // "model",
    "nodeid",
    "nodesets",
    "numeric-range",
    "object-registry",
    // "packet-analyser",
    // "packet-assembler",
    "pseudo-session",
    "secure-channel",
    "server",
    "server-configuration",
    // "server-discovery",
    "service-browse",
    "service-call",
    "service-discovery",
    "service-endpoints",
    "service-filter",
    "service-history",
    "service-node-management",
    "service-read",
    "service-write",
    "service-subscription",
    "variant",
];

const sources = nodeopcuaModules.map((a: string) => {
  
    const index = path.join(__dirname, `../packages/node-opcua-${a}/source/index.ts`);
    if (!fs.existsSync(index)) {
       console.log(" Warning file ", index, " doesn't exist")
    }
    return index;
});
sources.unshift(path.join(__dirname, `../packages/node-opcua/source/index.ts`));
app.generateDocs(sources, path.join(__dirname, "../../node-opcua.github.io/api_doc/2.0.0"));
