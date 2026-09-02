#!/usr/bin/env node
/**
 * opcua-nodeset-image: precompiled images of NodeSet2 files, without writing code.
 *
 *   opcua-nodeset-image build <file.xml>... [--out <dir>]
 *       writes <name>.ndjson.gz next to each source, or into --out; prints source size,
 *       image size, node count and elapsed time; exit code 1 when a file fails, the others
 *       are still processed
 *   opcua-nodeset-image verify <file.xml>... [--require <file.xml>]...
 *       loads each file from XML and from its image into two address spaces and compares
 *       them; dependencies come from the node-opcua-nodesets catalog, or from --require
 *   opcua-nodeset-image info <image>
 *       prints the header and the trailer of an image
 */
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { AddressSpace, generateAddressSpaceRaw, preLoad, readNodesetImageInfo } = require("../dist/api/index.js");
const { digestAddressSpace, nodesetFileToImage, readNodeSet2XmlFile } = require("../distNodeJS/index.js");

const usage = () => {
    console.error("usage: opcua-nodeset-image build <file.xml>... [--out <dir>]");
    console.error("       opcua-nodeset-image verify <file.xml>... [--require <file.xml>]...");
    console.error("       opcua-nodeset-image info <image>");
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

const imageFileOf = (file, outDir) => {
    const base = path.basename(file).replace(/\.xml$/i, "");
    return path.join(outDir ?? path.dirname(file), `${base}.ndjson.gz`);
};
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function build(files, options) {
    let failed = 0;
    for (const file of files) {
        const t0 = performance.now();
        try {
            const image = await nodesetFileToImage(file);
            const target = imageFileOf(file, options.out);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, image);
            const info = await readNodesetImageInfo(image);
            const source = fs.statSync(file).size;
            console.log(
                `${path.basename(file)}: ${kb(source)} -> ${path.basename(target)} ${kb(image.length)}, ${info.trailer.nodes} nodes, ${(performance.now() - t0).toFixed(0)} ms`
            );
        } catch (err) {
            failed += 1;
            console.error(`${file}: ${err.message}`);
        }
    }
    return failed > 0 ? 1 : 0;
}

/** the files a document requires, in load order, from the catalog and the --require files */
async function dependencyChain(file, requireFiles) {
    let catalog = [];
    let nodesets = {};
    try {
        ({ nodesetCatalog: catalog, nodesets } = require("node-opcua-nodesets"));
    } catch {
        /* the catalog is optional */
    }
    const known = new Map(); // model uri -> file
    for (const meta of catalog) {
        if (nodesets[meta.name] && fs.existsSync(nodesets[meta.name])) known.set(meta.uri, nodesets[meta.name]);
    }
    for (const required of requireFiles) {
        const [desc] = await preLoad([required], readNodeSet2XmlFile);
        for (const model of desc.namespaceModel.models) known.set(model.modelUri, required);
    }
    const order = [];
    const visit = async (f) => {
        const [desc] = await preLoad([f], readNodeSet2XmlFile);
        for (const model of desc.namespaceModel.models) {
            for (const required of model.requiredModel) {
                const dependency = known.get(required.modelUri);
                if (!dependency) throw new Error(`${path.basename(f)} requires ${required.modelUri}: not in the catalog, pass it with --require`);
                if (!order.includes(dependency) && dependency !== f) await visit(dependency);
            }
        }
        if (!order.includes(f)) order.push(f);
    };
    await visit(file);
    return order;
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
            const asFile = (f) => ({ name: f, source: () => [new Uint8Array(fs.readFileSync(f))] });
            const fromXml = await load(chain.map(asFile));
            const fromImage = await load(chain.map((f) => (f === file ? { name: `${f} (image)`, source: image } : asFile(f))));
            const same = fromXml.hash === fromImage.hash && fromXml.nodes === fromImage.nodes && fromXml.references === fromImage.references;
            console.log(`${path.basename(file)}: ${fromXml.nodes} nodes, ${fromXml.references} references, image ${same ? "identical" : "DIFFERS"}`);
            if (!same) failed += 1;
        } catch (err) {
            failed += 1;
            console.error(`${file}: ${err.message}`);
        }
    }
    return failed > 0 ? 1 : 0;
}

async function info(files) {
    for (const file of files) {
        const bytes = new Uint8Array(fs.readFileSync(file));
        const { header, trailer, lines } = await readNodesetImageInfo(bytes);
        console.log(JSON.stringify({ file, size: bytes.length, header, trailer, lines }, null, 2));
    }
    return 0;
}

async function main() {
    const [command, ...rest] = process.argv.slice(2);
    const { files, options } = parseArgs(rest);
    if (!command || files.length === 0) usage();
    switch (command) {
        case "build":
            return build(files, options);
        case "verify":
            return verify(files, options);
        case "info":
            return info(files);
        default:
            usage();
    }
}

main().then(
    (code) => process.exit(code),
    (err) => {
        console.error(err.message);
        process.exit(1);
    }
);
