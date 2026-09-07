/**
 * What does the precompiled NDJSON image buy over the NodeSet2 XML it was built from?
 *
 * Run from packages/node-opcua-address-space after `pnpm run build`:
 *
 *     node --import tsx benchmark/bench_nodeset_image.ts             # every section
 *     node --import tsx benchmark/bench_nodeset_image.ts size        # bytes only, no loading
 *     node --import tsx benchmark/bench_nodeset_image.ts parse 9     # parse phase only, 9 runs
 *     node --import tsx benchmark/bench_nodeset_image.ts load 5      # whole address spaces, 5 runs
 *     node --import tsx benchmark/bench_nodeset_image.ts cold 3      # one load per fresh process
 *
 * Three sections, because they answer three different questions and the answers differ by a lot:
 *
 *   size    both forms compressed the same way, gzip level 9, over the whole published catalogue.
 *           Compressed NDJSON against *uncompressed* XML is not a comparison anyone should quote:
 *           whoever ships the XML can gzip it too.
 *   parse   source bytes to the record stream, no address space built. This is the part the format
 *           actually changes.
 *   load    a whole address space, dependency chain included. Warm (best of N in one process) and
 *           cold (one load per fresh process, JIT warm-up included, which is what a server start
 *           pays). Building the address space dominates both, and that work is identical whichever
 *           form the records came from -- so the parse gain is diluted here, and that is the point
 *           of measuring it separately rather than quoting the parse number and implying the load.
 *
 * The best of N is reported rather than the mean: on a busy machine the distribution is bimodal and
 * the minimum is the estimate of the intrinsic cost.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import zlib from "node:zlib";
import { nodesetCatalog, nodesets } from "node-opcua-nodesets";
import { AddressSpace, generateAddressSpaceRaw, imageNodesetRecords, xmlNodesetRecords } from "../dist/api/index.js";
import "../distNodeJS/index.js";
import { chainOf } from "../test/nodeset_chain.js";

const [section = "all", runsArg] = process.argv.slice(2);
const runs = runsArg ? Number.parseInt(runsArg, 10) : undefined;

const nodesetDir = path.dirname(nodesets.standard);
const imageOf = (xmlFile: string) => xmlFile.replace(/\.xml$/i, ".ndjson.gz");
const asSource = (file: string) => ({ name: file, source: () => [new Uint8Array(fs.readFileSync(file))] });
const kb = (n: number) => n.toLocaleString("en-US");

/**
 * the chains worth timing: each is a nodeset plus everything it requires, in load order.
 *
 * Resolved from the catalog rather than listed by hand. The hand-written list silently went
 * stale -- MachineTool grew a dependency on isa95JobControl and machineryJobs, and the chain
 * that omitted them threw "Cannot find namespace" instead of producing a number, which is how
 * the longest chains quietly stopped being measured at all.
 */
const CHAINS: Array<{ label: string; files: string[] }> = [
    { label: "standard", name: "standard" },
    { label: "standard + DI", name: "di" },
    { label: "+ IA + Machinery", name: "machinery" },
    { label: "+ MachineTool", name: "machineTool" },
    { label: "+ Woodworking", name: "woodworking" }
]
    .filter(({ name }) => nodesetCatalog.some((m) => m.name === name))
    .map(({ label, name }) => ({ label, files: chainOf(name).map((n) => nodesets[n as keyof typeof nodesets]) }))
    .filter((c) => c.files.every((f) => f && fs.existsSync(f) && fs.existsSync(imageOf(f))));

async function best<T>(n: number, fn: () => Promise<T>): Promise<{ ms: number; last: T }> {
    let ms = Number.POSITIVE_INFINITY;
    let last!: T;
    for (let i = 0; i < n; i++) {
        const t = performance.now();
        last = await fn();
        const e = performance.now() - t;
        if (e < ms) ms = e;
    }
    return { ms, last };
}

function sizeSection(): void {
    console.log("\n--- size: the published catalogue, both forms at gzip level 9 ---\n");
    let xmlRaw = 0;
    let xmlGz = 0;
    let ndjsonRaw = 0;
    let ndjsonGz = 0;
    const rows: Array<[string, number, number, number]> = [];
    for (const file of fs.readdirSync(nodesetDir).filter((f) => f.endsWith(".ndjson.gz"))) {
        const xmlFile = path.join(nodesetDir, file.replace(/\.ndjson\.gz$/, ".xml"));
        if (!fs.existsSync(xmlFile)) continue;
        const xml = fs.readFileSync(xmlFile);
        const gz = zlib.gzipSync(xml, { level: 9 }).length;
        const image = fs.readFileSync(path.join(nodesetDir, file));
        xmlRaw += xml.length;
        xmlGz += gz;
        ndjsonRaw += zlib.gunzipSync(image).length;
        ndjsonGz += image.length;
        rows.push([file.replace(/\.ndjson\.gz$/, ""), xml.length, gz, image.length]);
    }
    rows.sort((a, b) => b[1] - a[1]);
    console.log(`${"nodeset".padEnd(44)}${"xml".padStart(11)}${"xml.gz".padStart(11)}${"ndjson.gz".padStart(11)}   ratio`);
    for (const [name, raw, gz, image] of rows.slice(0, 8)) {
        console.log(
            `${name.padEnd(44)}${kb(raw).padStart(11)}${kb(gz).padStart(11)}${kb(image).padStart(11)}   ${(image / gz).toFixed(2)}x`
        );
    }
    console.log(
        `${`TOTAL (${rows.length} files)`.padEnd(44)}${kb(xmlRaw).padStart(11)}${kb(xmlGz).padStart(11)}${kb(ndjsonGz).padStart(11)}   ${(ndjsonGz / xmlGz).toFixed(2)}x`
    );
    console.log(`\nndjson.gz vs xml.gz : ${((ndjsonGz / xmlGz) * 100).toFixed(1)} %  <- the fair comparison`);
    console.log(`ndjson vs xml, raw  : ${((ndjsonRaw / xmlRaw) * 100).toFixed(1)} %  <- what a parser works on`);
    console.log(`ndjson.gz vs raw xml: ${((ndjsonGz / xmlRaw) * 100).toFixed(1)} %  <- do not quote this one`);
}

async function parseSection(n: number): Promise<void> {
    console.log(`\n--- parse: source bytes to records, no address space, best of ${n} ---\n`);
    console.log(`${"document".padEnd(38)}${"records".padStart(9)}${"xml".padStart(10)}${"ndjson".padStart(10)}   ratio`);
    const files = ["standard", "di", "woodworking", "scales"]
        .map((k) => nodesets[k as keyof typeof nodesets] as string)
        .filter((f) => f && fs.existsSync(f) && fs.existsSync(imageOf(f)));
    for (const file of files) {
        const xml = fs.readFileSync(file, "utf8");
        const image = new Uint8Array(fs.readFileSync(imageOf(file)));
        const count = async (it: AsyncIterable<unknown>) => {
            let c = 0;
            for await (const _ of it) c++;
            return c;
        };
        const x = await best(n, () => count(xmlNodesetRecords([xml])));
        const g = await best(n, () => count(imageNodesetRecords(image)));
        console.log(
            `${path.basename(file, ".xml").padEnd(38)}${String(x.last).padStart(9)}` +
                `${`${x.ms.toFixed(0)} ms`.padStart(10)}${`${g.ms.toFixed(0)} ms`.padStart(10)}   ${(x.ms / g.ms).toFixed(1)}x`
        );
    }
}

async function loadOnce(files: string[]): Promise<number> {
    const addressSpace = AddressSpace.create();
    try {
        await generateAddressSpaceRaw(addressSpace, files.map(asSource), { imageStore: false });
        let nodes = 0;
        for (const ns of addressSpace.getNamespaceArray()) {
            for (const _ of ns.nodeIterator()) nodes++;
        }
        return nodes;
    } finally {
        addressSpace.dispose();
    }
}

async function loadSection(n: number): Promise<void> {
    console.log(`\n--- load: a whole address space, warm, best of ${n} in one process ---\n`);
    console.log(`${"chain".padEnd(38)}${"nodes".padStart(9)}${"xml".padStart(10)}${"ndjson".padStart(10)}   ratio`);
    for (const { label, files } of CHAINS) {
        const x = await best(n, () => loadOnce(files));
        const g = await best(n, () => loadOnce(files.map(imageOf)));
        console.log(
            `${label.padEnd(38)}${String(x.last).padStart(9)}` +
                `${`${x.ms.toFixed(0)} ms`.padStart(10)}${`${g.ms.toFixed(0)} ms`.padStart(10)}   ${(x.ms / g.ms).toFixed(1)}x`
        );
    }
}

/** one load per fresh process: what a server start pays, JIT warm-up included */
async function coldSection(n: number): Promise<void> {
    if (process.env.BENCH_COLD_ONE) {
        const files = JSON.parse(process.env.BENCH_COLD_ONE) as string[];
        const t = performance.now();
        const nodes = await loadOnce(files);
        process.stdout.write(JSON.stringify({ ms: performance.now() - t, nodes }));
        return;
    }
    console.log(`\n--- load: cold, one load per fresh process, best of ${n} ---\n`);
    console.log(`${"chain".padEnd(38)}${"nodes".padStart(9)}${"xml".padStart(10)}${"ndjson".padStart(10)}   ratio`);
    const runOne = (files: string[]): { ms: number; nodes: number } => {
        let ms = Number.POSITIVE_INFINITY;
        let nodes = 0;
        for (let i = 0; i < n; i++) {
            const r = spawnSync(process.execPath, ["--import", "tsx", process.argv[1], "cold"], {
                env: { ...process.env, BENCH_COLD_ONE: JSON.stringify(files) },
                encoding: "utf8"
            });
            const line = (r.stdout || "").split("\n").find((l) => l.startsWith("{"));
            if (!line) continue;
            const j = JSON.parse(line) as { ms: number; nodes: number };
            nodes = j.nodes;
            if (j.ms < ms) ms = j.ms;
        }
        return { ms, nodes };
    };
    for (const { label, files } of CHAINS) {
        const x = runOne(files);
        const g = runOne(files.map(imageOf));
        console.log(
            `${label.padEnd(38)}${String(x.nodes).padStart(9)}` +
                `${`${x.ms.toFixed(0)} ms`.padStart(10)}${`${g.ms.toFixed(0)} ms`.padStart(10)}   ${(x.ms / g.ms).toFixed(1)}x`
        );
    }
}

(async () => {
    if (CHAINS.length === 0 && section !== "size") {
        console.log("no nodeset has an image next to it: run `npm run build:images` in node-opcua-nodesets first");
    }
    if (section === "all" || section === "size") sizeSection();
    if (section === "all" || section === "parse") await parseSection(runs ?? 7);
    if (section === "all" || section === "load") await loadSection(runs ?? 5);
    if (section === "cold") await coldSection(runs ?? 3);
    if (section === "all") {
        console.log("\n(cold-start numbers: `node --import tsx benchmark/bench_nodeset_image.ts cold`)");
    }
    console.log(`\nnode ${process.version}`);
})();
