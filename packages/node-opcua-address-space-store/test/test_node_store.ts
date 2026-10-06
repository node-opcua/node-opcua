import { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import should from "should";
import { NO_NODE, NodeStore } from "../source/index.js";

describe("NodeStore", () => {
    const numeric = (ns: number, i: number) => new NodeId(NodeIdType.NUMERIC, i, ns);

    it("stores a node and gives its attributes back", () => {
        const store = new NodeStore(4);
        const type = store.add({
            nodeId: numeric(0, 58),
            nodeClass: NodeClass.ObjectType,
            browseName: "BaseObjectType",
            browseNameNamespace: 0,
            isAbstract: false
        });
        const i = store.add({
            nodeId: new NodeId(NodeIdType.STRING, "Pump.Speed", 2),
            nodeClass: NodeClass.Variable,
            browseName: "Speed",
            browseNameNamespace: 2,
            description: "rotations per minute",
            typeDefinition: type,
            valueRank: -1,
            accessLevel: 3,
            minimumSamplingInterval: 100,
            historizing: true
        });
        should(store.count).eql(2);
        should(store.find(new NodeId(NodeIdType.STRING, "Pump.Speed", 2))).eql(i);
        should(store.nodeId(i).toString()).eql("ns=2;s=Pump.Speed");
        should(store.nodeClass(i)).eql(NodeClass.Variable);
        should(store.browseName(i)).eql("Speed");
        should(store.browseNameNamespace(i)).eql(2);
        should(store.displayName(i)).eql("Speed", "defaults to the browse name");
        should(store.description(i)).eql("rotations per minute");
        should(store.description(type)).eql(null);
        should(store.typeDefinition(i)).eql(type);
        should(store.dataType(i)).eql(NO_NODE);
        should(store.valueRank(i)).eql(-1);
        should(store.accessLevel(i)).eql(3);
        should(store.userAccessLevel(i)).eql(3, "defaults to the access level");
        should(store.minimumSamplingInterval(i)).eql(100);
        should(store.historizing(i)).eql(true);
        should(store.isAbstract(i)).eql(false);
    });

    it("gives back every kind of NodeId as it was", () => {
        const store = new NodeStore();
        const ids = [
            numeric(7, 4294967295),
            new NodeId(NodeIdType.STRING, "a/b/c", 1),
            new NodeId(NodeIdType.GUID, "72962b91-fa75-4ae6-8d28-b404dc7daf63", 1),
            new NodeId(NodeIdType.BYTESTRING, Buffer.from([0, 255, 7]), 1)
        ];
        const indexes = ids.map((nodeId, k) =>
            store.add({ nodeId, nodeClass: NodeClass.Object, browseName: `N${k}`, browseNameNamespace: 1 })
        );
        indexes.forEach((i, k) => {
            should(store.nodeId(i).toString()).eql(ids[k].toString());
            should(store.find(ids[k])).eql(i);
        });
    });

    it("refuses a duplicate NodeId", () => {
        const store = new NodeStore();
        store.add({ nodeId: numeric(1, 1), nodeClass: NodeClass.Object, browseName: "A", browseNameNamespace: 1 });
        should(() =>
            store.add({ nodeId: numeric(1, 1), nodeClass: NodeClass.Object, browseName: "B", browseNameNamespace: 1 })
        ).throw(/exists already/);
    });

    it("forgets a deleted node by NodeId and marks its index", () => {
        const store = new NodeStore();
        const i = store.add({ nodeId: numeric(1, 1), nodeClass: NodeClass.Object, browseName: "A", browseNameNamespace: 1 });
        store.delete(i);
        should(store.find(numeric(1, 1))).eql(NO_NODE);
        should(store.isDeleted(i)).eql(true);
        should(store.count).eql(1);
    });

    it("grows, compacts, and shares browse names between nodes", () => {
        const store = new NodeStore(8);
        for (let i = 0; i < 5000; i++) {
            store.add({
                nodeId: numeric(1, 1000 + i),
                nodeClass: NodeClass.Variable,
                browseName: `Tag${i % 10}`,
                browseNameNamespace: 1
            });
        }
        store.compact();
        should(store.count).eql(5000);
        should(store.strings.size).eql(10, "ten distinct browse names");
        should(store.browseName(4999)).eql("Tag9");
        should(store.find(numeric(1, 1000 + 4321))).eql(4321);
        should(store.browseNameId(0)).eql(store.browseNameId(10));
    });
});
