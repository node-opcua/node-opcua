// to launch in the documentation folder
import * as path from "path";
import { Application } from "typedoc";

// @ts-ignore
const app = new Application({
    experimentalDecorators: true,
    logger: "console",
    mode: "modules",
    module: "commonjs",
    target: "es2015",

    gaID: "UA-25438821-3",
    gaSite: "node-opcua.github.io"
});

const nodeopcuaModules = [
    "address-space",
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
    // "server",
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
    "types"

];

const sources = nodeopcuaModules.map((a: string) =>
  path.join(__dirname, `../packages/node-opcua-${a}/source/index.ts`)
);
sources.unshift(path.join(__dirname, `../packages/node-opcua/source/index.ts`));
app.generateDocs(sources, path.join(__dirname, "../../node-opcua.github.io/api_doc/next"));
