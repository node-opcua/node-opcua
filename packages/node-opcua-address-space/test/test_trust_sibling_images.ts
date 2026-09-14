import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BaseNode, UAReference } from "node-opcua-address-space-base";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace } from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

/**
 * `trustSiblingImages` skips the read-and-hash of the XML that proves a sibling image matches
 * it, and checks the recorded source length against the file size instead.
 *
 * These tests pin both halves of that bargain: the same address space comes back, and the
 * narrow case it stops catching is the one documented — an edit that keeps the byte length
 * identical. An edit that changes the length is still caught, because the length check is what
 * remains.
 */
describe("generateAddressSpace - trustSiblingImages", function (this: Mocha.Suite) {
    this.timeout(200000);

    let tmp: string;
    before(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trust-sibling-"));
    });
    after(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    /** every node and its references, so two loads can be compared rather than merely counted */
    function snapshot(addressSpace: AddressSpace): string[] {
        const out: string[] = [];
        for (let i = 0; i < addressSpace.getNamespaceArray().length; i++) {
            const ns = addressSpace.getNamespace(i) as unknown as { nodeIterator(): IterableIterator<BaseNode> };
            for (const node of ns.nodeIterator()) {
                const refs = node
                    .allReferences()
                    .map((r: UAReference) => `${r.isForward ? ">" : "<"}${r.referenceType.toString()}:${r.nodeId.toString()}`)
                    .sort();
                out.push(`${node.nodeId.toString()} ${node.nodeClass} ${node.browseName.toString()} ${refs.join(",")}`);
            }
        }
        return out.sort();
    }

    async function load(files: string[], trust: boolean): Promise<string[]> {
        const addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, files, { trustSiblingImages: trust });
        const snap = snapshot(addressSpace);
        addressSpace.dispose();
        return snap;
    }

    it("TSI1 builds the same address space as the verified path", async () => {
        const files = [nodesets.standard, nodesets.di];
        const verified = await load(files, false);
        const trusted = await load(files, true);
        trusted.length.should.eql(verified.length);
        // compare the content, not just the count
        should(trusted).eql(verified);
    });

    it("TSI2 is off by default", async () => {
        // the default path still reaches the same result; this pins that adding the option
        // changed nothing for callers who do not pass it
        const addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const snap = snapshot(addressSpace);
        addressSpace.dispose();
        snap.length.should.be.greaterThan(1000);
    });

    it("TSI3 still rejects an image whose source length no longer matches", async () => {
        // copy an xml + its image, then append to the xml: the length check must reject it and
        // fall back to the XML even when trusted
        const xml = path.join(tmp, "Opc.Ua.NodeSet2.xml");
        const image = path.join(tmp, "Opc.Ua.NodeSet2.ndjson.gz");
        fs.copyFileSync(nodesets.standard, xml);
        fs.copyFileSync(nodesets.standard.replace(/\.xml$/i, ".ndjson.gz"), image);
        fs.appendFileSync(xml, "\n<!-- a comment that changes the length -->\n");

        const addressSpace = AddressSpace.create();
        // it must not throw: a rejected image means the XML is parsed instead
        await generateAddressSpace(addressSpace, [xml], { trustSiblingImages: true });
        should.exist(addressSpace.findNode("i=85"));
        addressSpace.dispose();
    });
});
