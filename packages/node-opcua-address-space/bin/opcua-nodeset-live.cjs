#!/usr/bin/env node
/**
 * opcua-nodeset-live: the nodeset operations that need an information model, and only those.
 *
 * Each of these builds a real address space, which means resolving a dependency chain, loading
 * every namespace a document requires, and paying for the whole of node-opcua. That is the point
 * of keeping them apart from `opcua-nodeset-image`: converting a document between its two
 * spellings needs none of it, and a tool that quietly loaded a model to do a transcription would
 * be answering a different question from the one it was asked.
 *
 * What genuinely needs a model:
 *
 *   opcua-nodeset-live verify <file.xml>... [--require <file.xml>]...
 *       loads each file from XML and from its image into two address spaces and compares them.
 *       The comparison is of models, so there has to be one
 *   opcua-nodeset-live export <file.xml>... [--out <image>] [--require <file.xml>]...
 *       loads the files and writes the last one's namespace back out as an image, from the live
 *       address space. This is how a namespace that was never a document becomes one
 *   opcua-nodeset-live equivalence <file.xml>... [--require <file.xml>]... [--dump <dir>] [--quiet]
 *       the full round trip of the RFC, section 9.2: what a *given implementation* loses when it
 *       loads a document and writes it back. The narrower claim, about the format alone, is
 *       checked without an address space and lives in test_nodeset_records_to_xml.ts
 */
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { AddressSpace, generateAddressSpaceRaw, namespaceToImage, preLoad, readNodesetImageInfo } = require("../dist/api/index.js");
const {
    addressSpacePackageVersion,
    digestAddressSpace,
    nodesetFileToImage,
    readNodeSet2XmlFile
} = require("../distNodeJS/index.js");
const { asFile, dependencyChain, imageFileOf, kb } = require("./nodeset_tool_common.cjs");
const { equivalence } = require("./nodeset_equivalence.cjs");

const usage = () => {
    console.error("usage: opcua-nodeset-live verify      <file.xml>... [--require <file.xml>]...");
    console.error("       opcua-nodeset-live export      <file.xml>... [--out <image>] [--require <file.xml>]...");
    console.error("       opcua-nodeset-live equivalence <file.xml>... [--require <file.xml>]... [--dump <dir>] [--quiet]");
    process.exit(2);
};

function parseArgs(argv) {
    const files = [];
    const options = { out: undefined, require: [] };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--out") options.out = argv[++i];
        else if (arg === "--require") options.require.push(argv[++i]);
        else if (arg.startsWith("--")) usage();
        else files.push(arg);
    }
    return { files, options };
}

async function verify(files, options) {
    let failed = 0;
    for (const file of files) {
        try {
            const chain = await dependencyChain(file, options.require);
            const image = await nodesetFileToImage(file);
            const load = async (sources) => {
                const addressSpace = AddressSpace.create();
                try {
                    await generateAddressSpaceRaw(addressSpace, sources, {});
                    return digestAddressSpace(addressSpace);
                } finally {
                    addressSpace.dispose();
                }
            };
            const fromXml = await load(chain.map(asFile));
            const fromImage = await load(chain.map((f) => (f === file ? { name: `${f} (image)`, source: image } : asFile(f))));
            const same =
                fromXml.hash === fromImage.hash &&
                fromXml.nodes === fromImage.nodes &&
                fromXml.references === fromImage.references;
            console.log(
                `${path.basename(file)}: ${fromXml.nodes} nodes, ${fromXml.references} references, image ${same ? "identical" : "DIFFERS"}`
            );
            if (!same) failed += 1;
        } catch (err) {
            failed += 1;
            console.error(`${file}: ${err.message}`);
        }
    }
    return failed > 0 ? 1 : 0;
}

async function exportNamespace(files, options) {
    const last = files[files.length - 1];
    const chain = await dependencyChain(last, [...options.require, ...files.slice(0, -1)]);
    const addressSpace = AddressSpace.create();
    try {
        await generateAddressSpaceRaw(addressSpace, chain.map(asFile), {});
        const [desc] = await preLoad([last], readNodeSet2XmlFile);
        const modelUri = desc.namespaceModel.models[0]?.modelUri;
        const namespace = addressSpace.getNamespaceArray().find((n) => n.namespaceUri === modelUri);
        if (!namespace) throw new Error(`${path.basename(last)}: namespace ${modelUri} not found after loading`);
        const t0 = performance.now();
        const image = await namespaceToImage(namespace, { addressSpaceVersion: addressSpacePackageVersion() });
        const target = options.out ?? imageFileOf(last, undefined).replace(/\.ndjson\.gz$/, ".export.ndjson.gz");
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, image);
        const info = await readNodesetImageInfo(image);
        console.log(
            `${path.basename(last)}: namespace ${modelUri} -> ${path.basename(target)} ${kb(image.length)}, ${info.trailer.nodes} nodes, ${(performance.now() - t0).toFixed(0)} ms`
        );
        return 0;
    } finally {
        addressSpace.dispose();
    }
}

async function main() {
    const [command, ...rest] = process.argv.slice(2);
    if (!command) usage();
    if (command === "equivalence") {
        return equivalence(rest);
    }
    const { files, options } = parseArgs(rest);
    if (files.length === 0) usage();
    switch (command) {
        case "verify":
            return verify(files, options);
        case "export":
            return exportNamespace(files, options);
        default:
            return usage();
    }
}

main().then(
    (code) => process.exit(code),
    (err) => {
        console.error(err.stack || err.message);
        process.exit(1);
    }
);
