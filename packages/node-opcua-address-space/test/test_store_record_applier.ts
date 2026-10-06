import { readFileSync } from "node:fs";
import { Browser, CompactStore, NO_NODE } from "node-opcua-address-space-store";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace } from "../dist/api/index.js";
import { xmlNodesetRecords } from "../dist/api/loader/nodeset_xml_producer.js";
import { StoreRecordApplier } from "../dist/api/loader/store_record_applier.js";
import { generateAddressSpace } from "../nodeJS.js";

/** the file's namespaces, in order of appearance */
class NamespaceTable {
    public uris: string[] = [];
    indexOf(uri: string): number {
        let i = this.uris.indexOf(uri);
        if (i === -1) {
            i = this.uris.push(uri) - 1;
        }
        return i;
    }
}

async function loadIntoStore(
    xmlFile: string
): Promise<{ store: CompactStore; applier: StoreRecordApplier; namespaces: NamespaceTable; ms: number }> {
    const store = new CompactStore({ expectedNodes: 32768 });
    const namespaces = new NamespaceTable();
    const applier = new StoreRecordApplier(store, namespaces);
    const t = Date.now();
    for await (const record of xmlNodesetRecords([readFileSync(xmlFile, "utf8")])) {
        applier.apply(record);
    }
    const { unresolved } = applier.finish();
    should(unresolved).eql(0, "every reference of the standard nodeset points at a node of the file");
    return { store, applier, namespaces, ms: Date.now() - t };
}

describe("StoreRecordApplier: the standard nodeset into a compact store", function () {
    this.timeout(60000);
    let store: CompactStore;
    let applier: StoreRecordApplier;
    let ms: number;

    before(async () => {
        ({ store, applier, ms } = await loadIntoStore(nodesets.standard));
    });

    it("holds as many nodes as the object address space does", async () => {
        const addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        let objectNodes = 0;
        for (const _node of addressSpace.getNamespace(0).nodeIterator()) objectNodes++;
        addressSpace.dispose();
        should(store.nodeCount).eql(objectNodes);
        should(applier.nodeCount).eql(objectNodes);
        should(ms).be.below(30000);
    });

    it("finds the well-known nodes by NodeId, with their attributes", () => {
        const server = store.find(new NodeId(NodeIdType.NUMERIC, 2253, 0));
        should(server).not.eql(NO_NODE);
        should(store.nodes.browseName(server)).eql("Server");
        should(store.nodes.nodeClass(server)).eql(NodeClass.Object);
        should(store.nodes.typeDefinition(server)).eql(store.find(new NodeId(NodeIdType.NUMERIC, 2004, 0)), "ServerType");

        const currentTime = store.find(new NodeId(NodeIdType.NUMERIC, 2258, 0));
        should(store.nodes.nodeClass(currentTime)).eql(NodeClass.Variable);
        should(store.nodes.browseName(currentTime)).eql("CurrentTime");
        should(store.nodes.dataType(currentTime)).eql(store.find(new NodeId(NodeIdType.NUMERIC, 294, 0)), "UtcTime");
        should(store.nodes.valueRank(currentTime)).eql(-1);
    });

    it("answers a browse from either end of a reference", () => {
        const objects = store.find(new NodeId(NodeIdType.NUMERIC, 85, 0));
        const server = store.find(new NodeId(NodeIdType.NUMERIC, 2253, 0));
        const organizes = new NodeId(NodeIdType.NUMERIC, 35, 0);
        should(store.targets(objects, organizes, true)).containEql(server);
        should(store.targets(server, organizes, false)).eql([objects]);
        const hasComponent = new NodeId(NodeIdType.NUMERIC, 47, 0);
        const serverStatus = store.find(new NodeId(NodeIdType.NUMERIC, 2256, 0));
        should(store.targets(server, hasComponent, true)).containEql(serverStatus);
        should(store.targets(serverStatus, hasComponent, false)).eql([server]);
    });

    it("kept the values the file declares", () => {
        // ns=0;i=2259 ServerStatus.State has no value; i=11192 Server.ServerCapabilities.MaxArrayLength neither;
        // the enum strings of a few DataTypes do, as arrays: object values
        should(applier.objectValueCount).be.above(10);
        const namespaceArray = store.find(new NodeId(NodeIdType.NUMERIC, 2255, 0));
        should(store.nodes.browseName(namespaceArray)).eql("NamespaceArray");
    });

    it("browses with reference subtypes and translates a browse path, on indexes", () => {
        const browser = new Browser(store);
        const id = (i: number) => new NodeId(NodeIdType.NUMERIC, i, 0);
        const objects = store.find(id(85));
        const server = store.find(id(2253));
        const hierarchical = id(33);
        // Objects -> Server is an Organizes reference, a HierarchicalReference subtype
        const forward = browser.browse(objects, { referenceType: hierarchical, includeSubtypes: true, forward: true });
        should(forward.map((r) => r.target)).containEql(server);
        should(browser.browse(objects, { referenceType: hierarchical, includeSubtypes: false, forward: true })).eql([]);
        should(
            browser.browse(objects, { referenceType: id(35), includeSubtypes: false, forward: true }).map((r) => r.target)
        ).containEql(server);
        // only Variables among the Server's children
        const variables = browser.browse(server, { referenceType: hierarchical, forward: true, nodeClassMask: NodeClass.Variable });
        should(variables.every((r) => store.nodes.nodeClass(r.target) === NodeClass.Variable)).eql(true);
        should(variables.map((r) => store.nodes.browseName(r.target))).containEql("NamespaceArray");

        should(browser.child(server, 0, "ServerStatus", hierarchical)).eql(store.find(id(2256)));
        should(browser.child(server, 0, "Nothing", hierarchical)).eql(NO_NODE);

        const path = ["Server", "ServerStatus", "CurrentTime"].map((name) => ({ targetName: { namespaceIndex: 0, name } }));
        should(browser.translate(objects, path, hierarchical)).eql([store.find(id(2258))]);
        should(
            browser.translate(
                objects,
                [{ targetName: { namespaceIndex: 0, name: "Server" } }, { targetName: { namespaceIndex: 0, name: "Missing" } }],
                hierarchical
            )
        ).eql([]);
        // the hierarchy knows HasComponent is an Aggregates reference, and Organizes is not
        const ordinal = (i: number) => store.referenceTypeOrdinal(id(i));
        should(browser.hierarchy.isSubtypeOf(ordinal(47), ordinal(44))).eql(true, "HasComponent < Aggregates");
        should(browser.hierarchy.isSubtypeOf(ordinal(35), ordinal(44))).eql(false, "Organizes is not an Aggregates");
        should(browser.hierarchy.isSubtypeOf(ordinal(35), ordinal(33))).eql(true, "Organizes < HierarchicalReferences");
    });

    it("interns the vocabulary once", () => {
        should(store.nodes.strings.size).be.below(store.nodeCount, "browse names repeat");
    });
});
