import { Application } from "typedoc";

// @ts-ignore
const app = new Application({
    experimentalDecorators: true,
    logger: "console",
    mode: "modules",
    module: "commonjs",
    target: "es2015",
});

const nodeopcuaModules = [
    "common",
    "client",
    "basic-types",
    "binary-stream",
    "types",
];

const sources = nodeopcuaModules.map((a: string) =>
    `../packages/node-opcua-${a}/source/index.ts`,
);

app.generateDocs(sources, "../doc1");
