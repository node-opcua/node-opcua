import { readFileSync } from "node:fs";
import { StoreAddressSpace } from "node-opcua-address-space-store";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { compactRecordConsumer } from "../dist/api/index.js";
import { xmlNodesetRecords } from "../dist/api/loader/nodeset_xml_producer.js";

// findNode() answers StoreNodeView | null, and the builder takes that answer as it is: a node it
// found is the parent, a null is an error naming the option, and a failed addition leaves no node.
describe("store builder: the answer of findNode() is a valid node reference", function () {
    this.timeout(60000);
    let space: StoreAddressSpace;
    let ns: number;

    before(async () => {
        space = new StoreAddressSpace({ expectedNodes: 8192 });
        const consumer = compactRecordConsumer(space);
        for await (const record of xmlNodesetRecords([readFileSync(nodesets.standard, "utf8")])) {
            consumer.apply(record);
        }
        consumer.finish();
        ns = space.registerNamespace("urn:test:find-node");
    });

    it("SB-FN-1 addFolder takes findNode()'s answer without a cast", () => {
        const plant = space.addFolder(space.findNode("ns=0;i=85"), "Plant");
        const organized = space.findNode("ns=0;i=85")?.findReferences("Organizes", true) ?? [];
        should(organized.map((r) => r.nodeId.toString())).containEql(plant.nodeId.toString());
    });

    it("SB-FN-2 a null parent throws, names the option, and leaves no node", () => {
        const missing = space.findNode(`ns=${ns};s=NoSuchMachine`);
        should(missing).eql(null);
        should(() =>
            space.addVariable({
                nodeId: `ns=${ns};s=Orphan`,
                browseName: "Orphan",
                componentOf: missing,
                dataType: "Double"
            })
        ).throw(/componentOf is null/);
        should(space.findNode(`ns=${ns};s=Orphan`)).eql(null);
    });

    it("SB-FN-3 an unknown parent NodeId throws and leaves no node", () => {
        should(() =>
            space.addObject({ nodeId: `ns=${ns};s=Stray`, browseName: "Stray", organizedBy: `ns=${ns};s=NoSuchFolder` })
        ).throw(/no node/);
        should(space.findNode(`ns=${ns};s=Stray`)).eql(null);
    });

    it("SB-FN-4 installHistoricalDataNode(null) throws a message that says why", () => {
        should(() => space.installHistoricalDataNode(null)).throw(/variable is null/);
    });
});
