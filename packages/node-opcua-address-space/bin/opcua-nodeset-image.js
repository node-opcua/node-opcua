#!/usr/bin/env node
/**
 * opcua-nodeset-image: everything you can do to a nodeset document without an information model.
 *
 * Nothing here builds an address space. A NodeSet2 document and its NodeSet-NDJSON form are two
 * spellings of the same thing, so converting between them, reading one, or comparing two is a
 * transcription: no DataType definitions are needed, no dependency chain has to be resolved, and
 * nothing has to be loaded. That is what keeps this tool cheap, and what makes its answers about
 * the document rather than about node-opcua. For the few operations that do need a model, and
 * pay for one, see `opcua-nodeset-live`.
 *
 *   opcua-nodeset-image build <file.xml>... [--out <dir>]
 *       writes <name>.ndjson.gz next to each source, or into --out; prints source size,
 *       image size, node count and elapsed time. Exit 1 if a file fails, the others are
 *       still processed
 *   opcua-nodeset-image xml <file>... [--out <dir>]
 *       the other direction: writes <name>.nodeset2.xml from a document in either form
 *   opcua-nodeset-image records <file>
 *       the record stream as NDJSON on stdout, one record per line, uncompressed
 *   opcua-nodeset-image info <file>
 *       the header and the trailer of an image
 *   opcua-nodeset-image diff <a> <b>
 *       the two documents compared record by record; either may be XML or NDJSON
 */
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");
const { readNodesetImageInfo, recordsToNodeset2XML } = require("../dist/api/index.js");
const { nodesetFileToImage } = require("../distNodeJS/index.js");
const { imageFileOf, kb, recordsOfFile } = require("./nodeset_tool_common.js");

const usage = () => {
    console.error("usage: opcua-nodeset-image build   <file.xml>... [--out <dir>]");
    console.error("       opcua-nodeset-image xml     <file>...     [--out <dir>]");
    console.error("       opcua-nodeset-image records <file>");
    console.error("       opcua-nodeset-image info    <file>");
    console.error("       opcua-nodeset-image diff    <a> <b>");
    process.exit(2);
};

function parseArgs(argv) {
    const files = [];
    const options = { out: undefined };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--out") options.out = argv[++i];
        else if (arg.startsWith("--")) usage();
        else files.push(arg);
    }
    return { files, options };
}

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

async function toXml(files, options) {
    let failed = 0;
    for (const file of files) {
        const t0 = performance.now();
        try {
            const records = await recordsOfFile(file);
            const xml = recordsToNodeset2XML(records);
            const base = path
                .basename(file)
                .replace(/\.ndjson\.gz$/i, "")
                .replace(/\.xml$/i, "");
            const target = path.join(options.out ?? path.dirname(file), `${base}.nodeset2.xml`);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, xml);
            console.log(
                `${path.basename(file)}: ${records.length - 1} nodes -> ${path.basename(target)} ${kb(xml.length)}, ${(performance.now() - t0).toFixed(0)} ms`
            );
        } catch (err) {
            failed += 1;
            console.error(`${file}: ${err.message}`);
        }
    }
    return failed > 0 ? 1 : 0;
}

async function records(files) {
    for (const file of files) {
        for (const record of await recordsOfFile(file)) {
            console.log(JSON.stringify(record));
        }
    }
    return 0;
}

async function info(files) {
    for (const file of files) {
        const bytes = new Uint8Array(fs.readFileSync(file));
        const { header, trailer, lines } = await readNodesetImageInfo(bytes);
        console.log(JSON.stringify({ file, size: bytes.length, header, trailer, lines }, null, 2));
    }
    return 0;
}

/** the key a record is matched on across two documents; the header is one of a kind */
const keyOf = (record) => (record.kind === "header" ? "header" : record.nodeId.toString());

async function diff(files) {
    if (files.length !== 2) usage();
    const [a, b] = await Promise.all(files.map(recordsOfFile));
    const right = new Map(b.map((r) => [keyOf(r), r]));
    const seen = new Set();
    const differences = [];
    for (const left of a) {
        const key = keyOf(left);
        seen.add(key);
        const other = right.get(key);
        if (!other) {
            differences.push(`${key}: only in ${path.basename(files[0])}`);
            continue;
        }
        for (const field of new Set([...Object.keys(left), ...Object.keys(other)])) {
            const l = JSON.stringify(left[field]);
            const r = JSON.stringify(other[field]);
            if (l !== r) {
                differences.push(`${key}.${field}\n    A ${String(l).slice(0, 200)}\n    B ${String(r).slice(0, 200)}`);
            }
        }
    }
    for (const record of b) {
        if (!seen.has(keyOf(record))) differences.push(`${keyOf(record)}: only in ${path.basename(files[1])}`);
    }
    for (const line of differences.slice(0, 40)) console.log(line);
    if (differences.length > 40) console.log(`... and ${differences.length - 40} more`);
    console.log(
        differences.length === 0
            ? `${path.basename(files[0])} and ${path.basename(files[1])}: identical, ${a.length} records`
            : `${differences.length} difference(s) over ${a.length} records`
    );
    return differences.length === 0 ? 0 : 1;
}

async function main() {
    const [command, ...rest] = process.argv.slice(2);
    const { files, options } = parseArgs(rest);
    if (!command || files.length === 0) usage();
    switch (command) {
        case "build":
            return build(files, options);
        case "xml":
            return toXml(files, options);
        case "records":
            return records(files);
        case "info":
            return info(files);
        case "diff":
            return diff(files);
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
