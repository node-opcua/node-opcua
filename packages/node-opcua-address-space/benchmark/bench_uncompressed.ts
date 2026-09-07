/**
 * Where a warm load actually spends its time, and what compression costs.
 *
 * The parse section of `bench_nodeset_image.ts` says NDJSON reaches records about three times
 * faster than XML; its warm load section says a whole load of the standard nodeset alone is
 * *slower* from NDJSON. Both cannot be true unless the difference lives outside parsing, so this
 * times the phases separately, and compares the four forms a deployment can actually ship: each
 * of the two formats, compressed and not. Compressing the XML is the comparison that matters to
 * anyone choosing between them, because a 4 MB XML file is not what goes over a wire either.
 *
 *     node --import tsx benchmark/bench_uncompressed.ts [runs]
 */
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import zlib from "node:zlib";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace, generateAddressSpaceRaw, imageNodesetRecords, xmlNodesetRecords } from "../dist/api/index.js";
import "../distNodeJS/index.js";

const N = Number(process.argv[2] || 7);
const XML = nodesets.standard as string;
const GZ = XML.replace(/\.xml$/i, ".ndjson.gz");

const xmlBytes = new Uint8Array(fs.readFileSync(XML));
const gzBytes = new Uint8Array(fs.readFileSync(GZ));
const rawBytes = new Uint8Array(zlib.gunzipSync(Buffer.from(gzBytes)));
const xmlGzBytes = new Uint8Array(zlib.gzipSync(Buffer.from(xmlBytes), { level: 9 }));
const xmlText = new TextDecoder().decode(xmlBytes);

async function best(runs: number, fn: () => Promise<unknown>): Promise<number> {
    let ms = Number.POSITIVE_INFINITY;
    for (let i = 0; i < runs; i++) {
        const t = performance.now();
        await fn();
        ms = Math.min(ms, performance.now() - t);
    }
    return ms;
}

const count = async (it: AsyncIterable<unknown>) => {
    let c = 0;
    for await (const _ of it) c++;
    return c;
};

/** a fresh copy each time: the loader keeps inflated lines against the buffer it was given */
const sourceOf = (name: string, bytes: Uint8Array) => ({ name, source: () => [bytes.slice()] });

async function load(name: string, bytes: Uint8Array): Promise<number> {
    const addressSpace = AddressSpace.create();
    try {
        // biome-ignore lint/suspicious/noExplicitAny: the loader takes several source shapes
        await generateAddressSpaceRaw(addressSpace, [sourceOf(name, bytes)] as any, { imageStore: false });
        let nodes = 0;
        for (const ns of addressSpace.getNamespaceArray()) {
            for (const _ of ns.nodeIterator()) nodes++;
        }
        return nodes;
    } finally {
        addressSpace.dispose();
    }
}

(async () => {
    const nodes = { xml: 0, gz: 0, raw: 0 };
    nodes.xml = await load(XML, xmlBytes);
    nodes.gz = await load(GZ, gzBytes);
    nodes.raw = await load(GZ.replace(/\.gz$/, ""), rawBytes);
    if (nodes.xml !== nodes.gz || nodes.xml !== nodes.raw) {
        throw new Error(`the three forms did not agree: ${JSON.stringify(nodes)}`);
    }

    const inflate = await best(N, async () => {
        zlib.gunzipSync(Buffer.from(gzBytes));
    });
    const inflateXml = await best(N, async () => {
        zlib.gunzipSync(Buffer.from(xmlGzBytes));
    });
    const parseXml = await best(N, () => count(xmlNodesetRecords([xmlText])));
    const parseGz = await best(N, () => count(imageNodesetRecords(gzBytes.slice())));
    const parseRaw = await best(N, () => count(imageNodesetRecords(rawBytes.slice())));

    const loadXml = await best(N, () => load(XML, xmlBytes));
    // gzipped XML is not something the loader takes, so the inflate is paid here instead: this
    // is what an implementation shipping compressed XML would have to do for itself
    const loadXmlGz = await best(N, () => load(XML, new Uint8Array(zlib.gunzipSync(Buffer.from(xmlGzBytes)))));
    const loadGz = await best(N, () => load(GZ, gzBytes));
    const loadRaw = await best(N, () => load(GZ.replace(/\.gz$/, ""), rawBytes));

    const w = (s: string) => s.padEnd(40);
    const ms = (v: number) => `${v.toFixed(1)} ms`.padStart(11);
    const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`.padStart(9);

    console.log(`\n--- standard nodeset, warm, best of ${N}, ${nodes.xml} nodes ---\n`);
    console.log(`${w("input")}${"size".padStart(9)}${"parse".padStart(11)}${"whole load".padStart(11)}${"apply".padStart(11)}`);
    console.log(`${w("NodeSet2 XML")}${kb(xmlBytes.length)}${ms(parseXml)}${ms(loadXml)}${ms(loadXml - parseXml)}`);
    console.log(`${w("NodeSet2 XML, gzip (inflate included)")}${kb(xmlGzBytes.length)}${ms(parseXml + inflateXml)}${ms(loadXmlGz)}${ms(loadXmlGz - parseXml - inflateXml)}`);
    console.log(`${w("NodeSet-NDJSON, gzip")}${kb(gzBytes.length)}${ms(parseGz)}${ms(loadGz)}${ms(loadGz - parseGz)}`);
    console.log(`${w("NodeSet-NDJSON, uncompressed")}${kb(rawBytes.length)}${ms(parseRaw)}${ms(loadRaw)}${ms(loadRaw - parseRaw)}`);
    console.log("");
    console.log(`${w("gunzip of the NDJSON alone")}${"".padStart(9)}${ms(inflate)}`);
    console.log(`${w("gunzip of the XML alone")}${"".padStart(9)}${ms(inflateXml)}`);
    console.log(`\nnode ${process.version}`);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
