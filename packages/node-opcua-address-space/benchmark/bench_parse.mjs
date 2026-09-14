/**
 * The XML side of a load, on its own and without the GC distortion of keeping what it produces:
 * the standard nodeset and DI are fed to the record reader in the same 256 KB pieces the Node.js
 * loader reads them in, and every record is counted and dropped.
 *
 *     node benchmark/bench_parse.mjs [iterations]
 *
 * Reports the minimum over the iterations of:
 *   tokenize  SaxLtx with no-op handlers: the tokenizer's own cost
 *   engine    Xml2Json with an empty parser table: tokenizer + reader-state machinery
 *   records   the real nodeset reader: the above + the records it builds
 */
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { nodesets } from "node-opcua-nodesets";
import { Xml2Json } from "node-opcua-xml2json";
import { SaxLtx } from "node-opcua-xml2json/dist/source/thirdparties/parser/lts.js";
import { makeXmlNodesetRecordReader } from "../dist/api/loader/nodeset_xml_producer.js";

const iterations = Number.parseInt(process.argv[2] || "", 10) || 25;
const CHUNK = 256 * 1024;
const texts = [nodesets.standard, nodesets.di].map((f) => fs.readFileSync(f, "utf-8"));
const chunkSets = texts.map((t) => {
    const out = [];
    for (let i = 0; i < t.length; i += CHUNK) out.push(t.slice(i, i + CHUNK));
    return out;
});
const bytes = texts.reduce((a, t) => a + t.length, 0);

let sink = 0;
function bench(name, fn) {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        fn();
        const dt = performance.now() - t0;
        if (i > 0) best = Math.min(best, dt);
    }
    console.log(`${name}=${best.toFixed(1)}ms`);
    return best;
}

const noop = () => undefined;
const results = [];
results.push(
    bench("tokenize", () => {
        for (const chunks of chunkSets) {
            const sax = new SaxLtx({ skipBlankText: true, onStartElement: noop, onEndElement: noop, onText: noop });
            for (const c of chunks) sax.write(c);
            sax.end("");
        }
    })
);
results.push(
    bench("engine", () => {
        for (const chunks of chunkSets) {
            const engine = new Xml2Json({ parser: {} });
            engine.begin();
            for (const c of chunks) engine.write(c);
            engine.end();
        }
    })
);
results.push(
    bench("records", () => {
        for (const chunks of chunkSets) {
            const reader = makeXmlNodesetRecordReader();
            for (const c of chunks) sink += reader.write(c).length;
            sink += reader.end().length;
        }
    })
);
console.log(
    `RESULT tokenize=${results[0].toFixed(1)}ms engine=${results[1].toFixed(1)}ms records=${results[2].toFixed(1)}ms ` +
        `bytes=${(bytes / 1048576).toFixed(2)}MB sink=${sink}`
);
