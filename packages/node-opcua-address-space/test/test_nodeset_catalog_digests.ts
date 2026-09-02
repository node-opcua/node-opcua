/**
 * The address space built from every nodeset of the catalog, with its dependency chain, must
 * stay what it was: node count, reference count and a digest over ids, browse names, classes,
 * reference counts and values. The fixture was taken from the loader before the record split
 * (US-10.4) and pins the output of every producer since: the XML reader today, the image replay
 * of FEAT-11 tomorrow.
 *
 * To refresh the fixture after an intended change of what the loader produces:
 *     NODESET_CATALOG_DIGESTS_UPDATE=1 npx mocha test/test_nodeset_catalog_digests.ts
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nodesetCatalog, nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

interface Digest {
    files: string[];
    nodes: number;
    references: number;
    hash: string;
}

const fixtureFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "nodeset_catalog_digests.json");

export function digestAddressSpace(addressSpace: AddressSpace): Omit<Digest, "files"> {
    const lines: string[] = [];
    let references = 0;
    for (const namespace of addressSpace.getNamespaceArray()) {
        for (const node of namespace.nodeIterator()) {
            const refs = node.allReferences();
            references += refs.length;
            let line = `${node.nodeId.toString()}|${node.browseName.toString()}|${node.nodeClass}|${refs.length}`;
            if ((node as UAVariable).readValue) {
                const dataValue = (node as UAVariable).readValue();
                line += `|${dataValue.statusCode.toString()}|${dataValue.value.toString()}`;
            }
            lines.push(line);
        }
    }
    lines.sort();
    return { nodes: lines.length, references, hash: createHash("sha1").update(lines.join("\n")).digest("hex") };
}

/** a nodeset with its dependencies, the standard nodeset first, in load order */
function chainOf(name: string): string[] {
    const byName = new Map(nodesetCatalog.map((m) => [m.name as string, m]));
    const acc: string[] = [];
    const visit = (n: string) => {
        const meta = byName.get(n);
        if (!meta) throw new Error(`unknown nodeset ${n}`);
        for (const dep of meta.dependencies) visit(dep);
        if (!acc.includes(n)) acc.push(n);
    };
    visit(name);
    if (!acc.includes("standard")) acc.unshift("standard");
    return acc;
}

describe("The catalog loads to the same address spaces as before the record split", function (this: Mocha.Suite) {
    this.timeout(10 * 60 * 1000);
    const update = !!process.env.NODESET_CATALOG_DIGESTS_UPDATE;
    const fixture: Record<string, Digest> = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
    const computed: Record<string, Digest> = {};

    after(() => {
        if (update) {
            fs.writeFileSync(fixtureFile, `${JSON.stringify(computed, null, 2)}\n`);
        }
    });

    for (const meta of nodesetCatalog) {
        const name = meta.name as string;
        const files = chainOf(name).map((n) => nodesets[n as keyof typeof nodesets]);
        if (files.some((f) => !f || !fs.existsSync(f))) {
            continue;
        }
        it(`${name} (${files.length} files)`, async () => {
            const addressSpace = AddressSpace.create();
            try {
                await generateAddressSpace(addressSpace, files);
                const digest = { files: chainOf(name), ...digestAddressSpace(addressSpace) };
                computed[name] = digest;
                if (!update) {
                    should.exist(fixture[name], `no fixture entry for ${name}: run with NODESET_CATALOG_DIGESTS_UPDATE=1`);
                    should(digest).eql(fixture[name]);
                }
            } finally {
                addressSpace.dispose();
            }
        });
    }
});
