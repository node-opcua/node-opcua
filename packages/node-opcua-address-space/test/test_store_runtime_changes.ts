import { readFileSync } from "node:fs";
import { NodeClass } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { xmlNodesetRecords } from "../dist/api/loader/nodeset_xml_producer.js";
import { StoreAddressSpace } from "../dist/impl/store_views/store_address_space.js";
import type { StoreVariableView } from "../dist/impl/store_views/store_variable_view.js";

describe("store runtime changes: nodes and references added and removed through the views", function () {
    this.timeout(60000);
    let space: StoreAddressSpace;
    let ns: number;

    before(async () => {
        space = new StoreAddressSpace({ expectedNodes: 8192 });
        const consumer = space.recordConsumer();
        for await (const record of xmlNodesetRecords([readFileSync(nodesets.standard, "utf8")])) {
            consumer.apply(record);
        }
        should(space.finishLoad().unresolved).eql(0);
        ns = space.registerNamespace("urn:test:runtime");
        should(ns).eql(1);
    });

    it("refuses a node before a namespace is registered", () => {
        const empty = new StoreAddressSpace();
        should(() => empty.addObject({ browseName: "X" })).throw(/register a namespace/);
    });

    it("adds a folder, an object and a variable under it, with allocated node ids", () => {
        const objects = space.findNode("ns=0;i=85");
        should(objects).not.eql(null);
        const folder = space.addFolder(objects as never, "Plant");
        should(folder.nodeId.toString()).eql("ns=1;i=1000");
        should(folder.browseName.toString()).eql("1:Plant");
        should(folder.typeDefinition.toString()).eql("ns=0;i=61");
        should(objects?.getChildByName("Plant", 1)).equal(folder);
        should(folder.findReferences("Organizes", false)[0].node).equal(objects);
        should(folder.parent).eql(null, "organizes is not an aggregation");

        const machine = space.addObject({ browseName: "Machine", organizedBy: folder });
        should(machine.nodeId.toString()).eql("ns=1;i=1001");
        should(machine.typeDefinition.toString()).eql("ns=0;i=58");

        const speed = space.addVariable({
            browseName: "Speed",
            componentOf: machine,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 12.5 }
        });
        should(speed.nodeId.toString()).eql("ns=1;i=1002");
        should(speed.nodeClass).eql(NodeClass.Variable);
        should(speed.dataType.toString()).eql("ns=0;i=11");
        should(speed.typeDefinition.toString()).eql("ns=0;i=63");
        should(speed.parent).equal(machine);
        should(machine.getComponentByName("Speed")).equal(speed);
        should(speed.readValue().value.value).eql(12.5);
        should(speed.readValue().statusCode).eql(StatusCodes.Good);

        const unit = space.addVariable({
            browseName: "Unit",
            propertyOf: speed,
            dataType: "String",
            value: { dataType: DataType.String, value: "rpm" }
        });
        should(unit.typeDefinition.toString()).eql("ns=0;i=68");
        should((speed.getPropertyByName("Unit") as StoreVariableView).readValue().value.value).eql("rpm");
        should(speed.getProperties().length).eql(1);
    });

    it("takes a node id, a qualified browse name, a data type by node id and a binding", () => {
        const machine = space.findNode("ns=1;i=1001");
        let reads = 0;
        const temperature = space.addVariable({
            nodeId: "ns=1;s=Temperature",
            browseName: "1:Temperature",
            componentOf: machine as never,
            dataType: "ns=0;i=10",
            value: { get: () => new Variant({ dataType: DataType.Float, value: ++reads }) }
        });
        should(space.findNode("ns=1;s=Temperature")).equal(temperature);
        should(temperature.dataType.toString()).eql("ns=0;i=10");
        should(temperature.readValue().value.value).eql(1);
        should(temperature.readValue().value.value).eql(2);
        should(() => space.addVariable({ nodeId: "ns=1;s=Temperature", browseName: "Again", dataType: "Double" })).throw(
            /exists already/
        );
        should(space.addObject({ browseName: "Next" }).nodeId.toString()).eql(
            "ns=1;i=1004",
            "after Plant, Machine, Speed and Unit"
        );
    });

    it("adds and removes a reference between existing nodes, both ends", () => {
        const plant = space.findNode("ns=1;i=1000");
        const speed = space.findNode("ns=1;i=1002");
        should(space.addReference(plant as never, "ns=0;i=47", speed as never)).eql(true);
        should(space.addReference(plant as never, "ns=0;i=47", speed as never)).eql(false, "already there");
        should(plant?.getComponentByName("Speed")).equal(speed);
        should(speed?.findReferences("HasComponent", false).map((r) => r.node.browseName.name)).eql(["Machine", "Plant"]);
        should(space.removeReference(plant as never, "ns=0;i=47", speed as never)).eql(true);
        should(space.removeReference(plant as never, "ns=0;i=47", speed as never)).eql(false);
        should(plant?.getComponentByName("Speed")).eql(null);
        should(speed?.findReferences("HasComponent", false).length).eql(1);
    });

    it("deletes a node with its references from both ends", () => {
        const machine = space.findNode("ns=1;i=1001");
        const speed = space.findNode("ns=1;i=1002") as StoreVariableView;
        const unit = speed.getPropertyByName("Unit");
        space.deleteNode(speed);
        should(speed.isDisposed()).eql(true);
        should(space.findNode("ns=1;i=1002")).eql(null);
        should(machine?.getComponentByName("Speed")).eql(null);
        should(machine?.getComponents().map((c) => c.browseName.name)).eql(["Temperature"]);
        should(unit?.findReferences("HasProperty", false).length).eql(0, "the property lost its parent reference");
        // the id can be given again
        const again = space.addVariable({
            nodeId: "ns=1;i=1002",
            browseName: "Speed2",
            componentOf: machine as never,
            dataType: "Double"
        });
        should(again.readValue().statusCode).eql(StatusCodes.BadWaitingForInitialData, "no value carried over");
        should(machine?.getComponentByName("Speed2")).equal(again);
    });

    it("keeps the loaded nodes browsable and the added ones reachable by path", () => {
        const objects = space.findNode("ns=0;i=85");
        should(objects?.getChildByName("Server", 0)?.nodeId.toString()).eql("ns=0;i=2253");
        const found = space.browser.translate(
            objects?.index ?? -1,
            [
                { targetName: { namespaceIndex: 1, name: "Plant" } },
                { targetName: { namespaceIndex: 1, name: "Machine" } },
                { targetName: { namespaceIndex: 1, name: "Temperature" } }
            ],
            resolveNodeId("ns=0;i=33")
        );
        should(found.map((i) => space.store.nodes.nodeId(i).toString())).eql(["ns=1;s=Temperature"]);
    });
});
