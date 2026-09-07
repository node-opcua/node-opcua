/**
 * The two ways a NodeSet-NDJSON document can become NodeSet2 XML again, and the claim each one
 * supports (see documentation/rfc/nodeset-ndjson.md, section 9).
 *
 * These run over the whole published catalogue and take minutes rather than seconds, which is
 * why they sit here and not in `test/`: `pnpm test` should stay short enough that nobody thinks
 * twice about running it. Run them with `pnpm run test:long`, and let CI run them on every push.
 *
 *   RTX-1  records -> XML -> records, with no address space anywhere in the loop. This is the
 *          claim about the *format*: if a record survives it unchanged, the two spellings carry
 *          the same document. It must hold for every catalog nodeset, with nothing excluded.
 *
 *   RTX-2  an element census of the source document against the regenerated one. RTX-1 cannot
 *          see an element that neither the reader nor the writer knows about: a round trip
 *          through a symmetrically lossy pair is a fixpoint, not a proof. Counting elements in
 *          the source is the only thing that can catch that class, and it is how the loss of
 *          Category, Documentation and Extensions was found.
 *
 *   RTX-3  the document written straight from the records and the document written from a loaded
 *          address space must load into the *same* address space. Where they do not, it is the
 *          address-space export that lost something, never the direct writer: RTX-1 is exact for
 *          every nodeset, so the records are known good on both sides.
 */
import fs from "node:fs";
import { nodesetCatalog, nodesets } from "node-opcua-nodesets";
import should from "should";
import {
    AddressSpace,
    generateAddressSpaceRaw,
    imageNodesetRecords,
    type NodesetRecord,
    recordsToNodeset2XML
} from "../dist/api/index.js";
import { digestAddressSpace, nodesetFileToImage } from "../distNodeJS/index.js";
import { chainOf } from "../test/nodeset_chain.js";

/**
 * the address-space export loses something on these two, so the two ways round do not meet.
 * Minor and known: the direct writer is exact on both (RTX-1), so nothing is lost by the format.
 * Remove a name here when the exporter stops dropping what it drops; the test fails if one of
 * them starts passing, so the list cannot quietly rot.
 */
const EXPORTER_LOSES_ON = new Set(["padim", "robotics"]);

const fileOf = (name: string) => nodesets[name as keyof typeof nodesets];
const asFile = (file: string) => ({ name: file, source: () => [new Uint8Array(fs.readFileSync(file))] });
const asText = (name: string, xml: string) => ({ name, source: () => [new TextEncoder().encode(xml)] });

async function recordsOf(image: Uint8Array): Promise<NodesetRecord[]> {
    const out: NodesetRecord[] = [];
    for await (const record of imageNodesetRecords(image)) {
        out.push(record);
    }
    return out;
}

async function digestOf(sources: Array<{ name: string; source: unknown }>) {
    const addressSpace = AddressSpace.create();
    try {
        // biome-ignore lint/suspicious/noExplicitAny: the loader takes several source shapes
        await generateAddressSpaceRaw(addressSpace, sources as any, {});
        return digestAddressSpace(addressSpace);
    } finally {
        addressSpace.dispose();
    }
}

/** every catalog entry whose file and whose whole dependency chain are on disk */
function loadable(): Array<{ name: string; uri: string; files: string[] }> {
    const out: Array<{ name: string; uri: string; files: string[] }> = [];
    for (const meta of nodesetCatalog) {
        const name = meta.name as string;
        const files = chainOf(name).map(fileOf);
        if (files.some((f) => !f || !fs.existsSync(f))) continue;
        out.push({ name, uri: meta.uri, files });
    }
    return out;
}

describe("NodeSet2 XML written straight from the records", function (this: Mocha.Suite) {
    this.timeout(10 * 60 * 1000);

    for (const { name, files } of loadable()) {
        const file = files[files.length - 1];

        it(`RTX-1 ${name} survives records -> XML -> records unchanged`, async () => {
            const before = await recordsOf(await nodesetFileToImage(file));
            const xml = recordsToNodeset2XML(before);
            const after = await recordsOf(await nodesetToImageOfText(xml));

            should(after.length).eql(before.length, "record count");

            const key = (r: NodesetRecord) => (r.kind === "header" ? "header" : r.nodeId.toString());
            const byKey = new Map(after.map((r) => [key(r), r]));
            const differences: string[] = [];
            for (const a of before) {
                const b = byKey.get(key(a));
                if (!b) {
                    differences.push(`${key(a)} is missing`);
                    continue;
                }
                for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
                    const left = JSON.stringify((a as unknown as Record<string, unknown>)[k]);
                    const right = JSON.stringify((b as unknown as Record<string, unknown>)[k]);
                    if (left !== right) {
                        differences.push(`${key(a)}.${k}: ${String(left).slice(0, 120)} != ${String(right).slice(0, 120)}`);
                    }
                }
            }
            should(differences.slice(0, 5)).eql([], `${differences.length} difference(s)`);
        });

        it(`RTX-2 ${name} reproduces every element the source declares`, async () => {
            const source = fs.readFileSync(file, "utf8");
            const xml = recordsToNodeset2XML(await recordsOf(await nodesetFileToImage(file)));
            // the elements a reader is most likely to drop silently, because nothing downstream
            // of the loader ever reads them back
            for (const element of ["Category", "Documentation", "Extension"]) {
                const count = (text: string) => (text.match(new RegExp(`<${element}[ >/]`, "g")) || []).length;
                should(count(xml)).eql(count(source), `<${element}> count`);
            }
        });
    }
});

describe("the two ways back to NodeSet2 XML agree", function (this: Mocha.Suite) {
    this.timeout(15 * 60 * 1000);

    for (const { name, uri, files } of loadable()) {
        const file = files[files.length - 1];
        const dependencies = files.slice(0, -1).map(asFile);
        const expectedToDiffer = EXPORTER_LOSES_ON.has(name);

        it(`RTX-3 ${name}${expectedToDiffer ? " (exporter is known to lose something)" : ""}`, async () => {
            const image = await nodesetFileToImage(file);

            // straight from the records: no address space is built to produce this
            const direct = recordsToNodeset2XML(await recordsOf(image));

            // through the address space: load the records, then ask the namespace to export itself
            const addressSpace = AddressSpace.create();
            let viaModel: string;
            try {
                const sources = [...dependencies, { name: `${file} (ndjson)`, source: image }];
                // biome-ignore lint/suspicious/noExplicitAny: the loader takes several source shapes
                await generateAddressSpaceRaw(addressSpace, sources as any, {});
                const namespace = addressSpace.getNamespaceArray().find((n) => n.namespaceUri === uri);
                should.exist(namespace, `namespace ${uri} after loading`);
                viaModel = (namespace as unknown as { toNodeset2XML(): string }).toNodeset2XML();
            } finally {
                addressSpace.dispose();
            }

            const [a, b] = await Promise.all([
                digestOf([...dependencies, asText("direct", direct)]),
                digestOf([...dependencies, asText("viaModel", viaModel)])
            ]);

            if (expectedToDiffer) {
                should(a.hash).not.eql(
                    b.hash,
                    "the exporter no longer loses anything here: take this nodeset out of EXPORTER_LOSES_ON"
                );
            } else {
                should({ nodes: a.nodes, references: a.references, hash: a.hash }).eql({
                    nodes: b.nodes,
                    references: b.references,
                    hash: b.hash
                });
            }
        });
    }
});

/** the image of a document held as text, for the second half of the round trip */
async function nodesetToImageOfText(xml: string): Promise<Uint8Array> {
    const { nodesetToImage } = await import("../dist/api/index.js");
    return nodesetToImage(asText("regenerated", xml), { addressSpaceVersion: "test" });
}
