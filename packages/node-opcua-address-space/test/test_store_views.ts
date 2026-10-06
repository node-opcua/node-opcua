import { readFileSync } from "node:fs";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { xmlNodesetRecords } from "../dist/api/loader/nodeset_xml_producer.js";
import { StoreAddressSpace } from "../dist/impl/store_views/store_address_space.js";
import { StoreVariableView } from "../dist/impl/store_views/store_variable_view.js";

describe("store views: node objects on demand over the compact store", function () {
    this.timeout(60000);
    let space: StoreAddressSpace;

    before(async () => {
        space = new StoreAddressSpace({ expectedNodes: 8192, viewCacheSize: 64 });
        const consumer = space.recordConsumer();
        for await (const record of xmlNodesetRecords([readFileSync(nodesets.standard, "utf8")])) {
            consumer.apply(record);
        }
        should(space.finishLoad().unresolved).eql(0);
    });

    it("finds a node and reads its attributes through a view", () => {
        const server = space.findNode("ns=0;i=2253");
        should(server).not.eql(null);
        should(server?.browseName.toString()).eql("Server");
        should(server?.nodeClass).eql(NodeClass.Object);
        should(server?.typeDefinition.toString()).eql("ns=0;i=2004");
        should(server?.typeDefinitionObj?.browseName.name).eql("ServerType");
        // Objects organizes Server: not an aggregation, so no parent, as in the object address space
        should(server?.parent).eql(null);
        should(space.findNode("ns=0;i=2256")?.parent?.nodeId.toString()).eql(
            "ns=0;i=2253",
            "ServerStatus is a component of Server"
        );
        should(server?.readAttribute(null, AttributeIds.DisplayName).value.value.text).eql("Server");
        should(server?.readAttribute(null, AttributeIds.Value).statusCode).eql(StatusCodes.BadAttributeIdInvalid);
    });

    it("hands out the same view for the same node while it is in use", () => {
        const a = space.findNode("ns=0;i=2253");
        const b = space.findNode("ns=0;i=2253");
        should(a).equal(b);
        const c = space.findNode("ns=0;i=2253")?.getComponentByName("ServerStatus");
        should(c).equal(space.findNode("ns=0;i=2256"));
    });

    it("keeps at most the configured number of views", () => {
        for (let i = 0; i < 500; i++) {
            space.viewOf(i);
        }
        should(space.viewCount).be.belowOrEqual(64);
        // an evicted index gets a fresh view, still answering the same node
        should(space.viewOf(3).nodeId.toString()).eql(space.store.nodes.nodeId(3).toString());
    });

    it("walks children and references", () => {
        const server = space.findNode("ns=0;i=2253");
        const status = server?.getChildByName("ServerStatus");
        should(status?.nodeId.toString()).eql("ns=0;i=2256");
        should(status?.getComponentByName("CurrentTime")?.nodeId.toString()).eql("ns=0;i=2258");
        should(server?.getProperties().map((p) => p.browseName.name)).containEql("NamespaceArray");
        const organizes = server?.findReferences("Organizes", false) ?? [];
        should(organizes.length).eql(1);
        should(organizes[0].node.browseName.name).eql("Objects");
        should(organizes[0].isForward).eql(false);
        should(server?.findReferencesEx("HierarchicalReferences", true).length).be.above(5);
    });

    it("reads, sets and binds the value of a Variable", () => {
        const currentTime = space.findNode("ns=0;i=2258") as StoreVariableView;
        should(currentTime).be.instanceOf(StoreVariableView);
        should(currentTime.dataType.toString()).eql("ns=0;i=294");
        should(currentTime.readValue().statusCode).eql(StatusCodes.BadWaitingForInitialData);

        const v0 = currentTime.valueVersion;
        currentTime.setValueFromSource(new Variant({ dataType: DataType.Double, value: 42.5 }));
        const read = currentTime.readValue();
        should(read.statusCode).eql(StatusCodes.Good);
        should(read.value.value).eql(42.5);
        should(read.sourceTimestamp).be.instanceOf(Date);
        should(currentTime.valueVersion).be.above(v0);

        let calls = 0;
        currentTime.bindVariable({
            get: () => {
                calls++;
                return new Variant({ dataType: DataType.Double, value: 7 });
            }
        });
        should(currentTime.readValue().value.value).eql(7);
        should(calls).eql(1);
        should(space.store.values.number(currentTime.index)).eql(7, "the getter's value is in the columns too");

        let written: Variant | undefined;
        currentTime.bindVariable({
            set: (value) => {
                written = value;
                return StatusCodes.Good.value;
            }
        });
        const status = currentTime.writeValue(new DataValue({ value: new Variant({ dataType: DataType.Double, value: 3 }) }));
        should(status).eql(StatusCodes.Good.value);
        should(written?.value).eql(3);
        should(currentTime.readValue().value.value).eql(3);
    });

    it("keeps a string value as an object", () => {
        const namespaceArray = space.findNode("ns=0;i=2255") as StoreVariableView;
        namespaceArray.setValueFromSource(
            new Variant({ dataType: DataType.String, arrayType: 1, value: ["http://opcfoundation.org/UA/", "urn:test"] })
        );
        const read = namespaceArray.readValue();
        should(read.value.value).eql(["http://opcfoundation.org/UA/", "urn:test"]);
        should(read.value.dataType).eql(DataType.String);
    });
});
