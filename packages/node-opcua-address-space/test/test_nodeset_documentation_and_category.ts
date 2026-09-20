/**
 * A UANode's `<Documentation>` link and `<Category>` elements reach the address space and leave
 * it again. The records kept them already; the node did not, so anything that works on a loaded
 * address space (toNodeset2XML, a reverse-engineering tool) saw none of them.
 *
 * The census is what proves it: a round trip through two converters that both drop an element
 * agrees with itself, so the source document is compared with the regenerated one.
 */
import fs from "node:fs";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, type BaseNode, type NodesetNodeRecord, xmlNodesetRecords } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";
import { chainOf } from "./nodeset_chain.js";

interface Census {
    /** the namespace the document defines: the first of its table */
    namespaceUri: string;
    documentation: Record<string, string>;
    category: Record<string, string[]>;
}

/** what each node of the document's own namespace declares, by the identifier of its NodeId */
async function censusOf(xml: string): Promise<Census> {
    const census: Census = { namespaceUri: "", documentation: {}, category: {} };
    for await (const record of xmlNodesetRecords([xml])) {
        if (record.kind === "header") census.namespaceUri = record.namespaceUris[0];
        if (record.kind !== "node") continue;
        const node = record as NodesetNodeRecord;
        // the document's own namespace is the first of its table, in the source and in the export
        if (node.nodeId.namespace !== 1) continue;
        const key = node.nodeId.value.toString();
        if (node.documentation !== undefined) census.documentation[key] = node.documentation;
        if (node.category) census.category[key] = node.category;
    }
    return census;
}

describe("Documentation and Category of a UANode, through the address space", function (this: Mocha.Suite) {
    this.timeout(2 * 60 * 1000);

    describe("a node that declares them", () => {
        let addressSpace: AddressSpace;
        before(async () => {
            addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, [
                nodesets.standard,
                getAddressSpaceFixture("nodeset_with_documentation_and_category.xml")
            ]);
        });
        after(() => addressSpace.dispose());

        /** a missing node must fail the test, not read as "declares nothing" */
        function nodeOf(nodeId: string): BaseNode {
            const node = addressSpace.findNode(nodeId);
            if (!node) throw new Error(`${nodeId} is not in the address space`);
            return node;
        }

        it("carries its documentation link and its categories, in order", () => {
            const pumpType = nodeOf("ns=1;i=1000");
            should(pumpType.nodesetDocumentation).eql("https://reference.opcfoundation.org/Pumps/v100/docs/7.1");
            should(pumpType.nodesetCategory).eql(["Pump Base", "Pump Extended"]);

            const speed = nodeOf("ns=1;i=2000");
            should(speed.nodesetDocumentation).eql("https://reference.opcfoundation.org/Pumps/v100/docs/7.2");
            should(speed.nodesetCategory).eql(undefined);
        });

        it("leaves both undefined on a node that declares neither", () => {
            const undocumented = nodeOf("ns=1;i=1001");
            should(undocumented.nodesetDocumentation).eql(undefined);
            should(undocumented.nodesetCategory).eql(undefined);
        });

        it("does not hand the link of a type down to its instances", () => {
            const pumpType = addressSpace.findObjectType("PumpType", 1);
            if (!pumpType) throw new Error("PumpType is not in the address space");
            const pump = pumpType.instantiate({ browseName: "Pump1", organizedBy: addressSpace.rootFolder.objects });
            should(pump.nodesetDocumentation).eql(undefined);
            should(pump.nodesetCategory).eql(undefined);
            should(pump.getComponentByName("Speed")).not.eql(null);
            should(pump.getComponentByName("Speed")?.nodesetDocumentation).eql(undefined);
        });

        it("writes them back between Description and References, as the schema orders them", () => {
            const xml = addressSpace.getNamespace("urn:documentation:test").toNodeset2XML();
            const pumpType = /<UAObjectType NodeId="ns=1;i=1000"[\s\S]*?<\/UAObjectType>/.exec(xml)?.[0] ?? "";
            const order = ["<Description>", "<Category>Pump Base<", "<Category>Pump Extended<", "<Documentation>", "<References>"];
            const positions = order.map((element) => pumpType.indexOf(element));
            should(positions.every((p) => p >= 0)).eql(true, `missing element in\n${pumpType}`);
            should(positions).eql([...positions].sort((a, b) => a - b));
        });
    });

    for (const name of ["di", "machinery"]) {
        it(`keeps every (NodeId, Documentation) and (NodeId, Category) pair of ${name}`, async () => {
            const files = chainOf(name).map((n) => nodesets[n as keyof typeof nodesets]);
            const source = await censusOf(fs.readFileSync(files[files.length - 1], "utf8"));
            // a census of nothing would pass whatever the exporter does
            should(Object.keys(source.documentation).length).be.greaterThan(10);
            should(Object.keys(source.category).length).be.greaterThan(10);

            const addressSpace = AddressSpace.create();
            try {
                await generateAddressSpace(addressSpace, files);
                const exported = await censusOf(addressSpace.getNamespace(source.namespaceUri).toNodeset2XML());
                should(exported.documentation).eql(source.documentation);
                should(exported.category).eql(source.category);
            } finally {
                addressSpace.dispose();
            }
        });
    }
});
