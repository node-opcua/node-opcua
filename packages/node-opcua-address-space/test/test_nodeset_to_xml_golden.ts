/**
 * toNodeset2XML is a consumer of the record walk. Its output for every catalog namespace is
 * pinned: the fixture holds the SHA-1 of the XML the exporter produced before the walk was lifted
 * out of it. Regenerate after an intended change of the export:
 *     NODESET_CATALOG_XML_DIGESTS_UPDATE=1 npx mocha test/test_nodeset_to_xml_golden.ts
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { nodesetCatalog, nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { packageRoot } from "./paths.js";

interface XmlDigest {
    uri: string;
    length: number;
    sha1: string;
}

const fixtureFile = path.join(packageRoot, "test", "fixtures", "nodeset_catalog_xml_digests.json");

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

describe("toNodeset2XML over the record walk writes what it wrote before", function (this: Mocha.Suite) {
    this.timeout(10 * 60 * 1000);
    const update = !!process.env.NODESET_CATALOG_XML_DIGESTS_UPDATE;
    const fixture: Record<string, XmlDigest> = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
    const computed: Record<string, XmlDigest> = {};
    const dumpDir = process.env.NODESET_CATALOG_XML_DUMP_DIR;

    after(() => {
        if (update) {
            fs.writeFileSync(fixtureFile, `${JSON.stringify(computed, null, 2)}\n`);
        }
    });

    for (const meta of nodesetCatalog) {
        const name = meta.name as string;
        if (name === "standard" || (!update && !fixture[name])) {
            // the UA namespace itself is not exported; a namespace absent from the fixture failed to export before
            continue;
        }
        const files = chainOf(name).map((n) => nodesets[n as keyof typeof nodesets]);
        if (files.some((f) => !f || !fs.existsSync(f))) {
            continue;
        }
        it(`${name}`, async () => {
            const addressSpace = AddressSpace.create();
            try {
                await generateAddressSpace(addressSpace, files, { imageStore: false });
                const namespace = addressSpace.getNamespaceArray().find((n) => n.namespaceUri === meta.uri);
                should.exist(namespace);
                const xml = (namespace as { toNodeset2XML(): string }).toNodeset2XML();
                if (dumpDir) {
                    fs.mkdirSync(dumpDir, { recursive: true });
                    fs.writeFileSync(path.join(dumpDir, `${name}.xml`), xml);
                }
                const digest: XmlDigest = { uri: meta.uri, length: xml.length, sha1: createHash("sha1").update(xml).digest("hex") };
                computed[name] = digest;
                if (!update) {
                    should(digest).eql(fixture[name]);
                }
            } finally {
                addressSpace.dispose();
            }
        });
    }
});
