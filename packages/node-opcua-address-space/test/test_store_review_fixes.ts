import { readFileSync } from "node:fs";
import { StoreAddressSpace, type StoreVariableView } from "node-opcua-address-space-store";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { compactRecordConsumer, StoreRecordApplier } from "../dist/api/index.js";
import { xmlNodesetRecords } from "../dist/api/loader/nodeset_xml_producer.js";

describe("store: what the review of the compact store found", function () {
    this.timeout(60000);
    let space: StoreAddressSpace;
    let ns: number;

    before(async () => {
        space = new StoreAddressSpace({ expectedNodes: 8192, viewCacheSize: 64 });
        const consumer = compactRecordConsumer(space);
        for await (const record of xmlNodesetRecords([readFileSync(nodesets.standard, "utf8")])) {
            consumer.apply(record);
        }
        should(consumer.finish().unresolved).eql(0);
        ns = space.registerNamespace("urn:test:review");
    });

    it("forgets a view with listeners once the last one leaves, even after it was read again", () => {
        const objects = space.findNode("ns=0;i=85") as never;
        const v = space.addVariable({ browseName: "Pinned", organizedBy: objects, dataType: "Double" });
        const listener = () => {};
        v.on("value_changed", listener);
        // the ring churns: the view leaves it but stays the node's view
        for (let i = 0; i < 2000; i++) space.viewOf(i % 1000);
        should(space.findNode(v.nodeId)).equal(v, "still the node's view while it has a listener");
        // read again after it left the ring, then the listener goes
        space.findNode(v.nodeId);
        v.removeListener("value_changed", listener);
        should(space.findNode(v.nodeId)).not.equal(v, "a fresh view: the pinned one was forgotten");
        for (let i = 0; i < 2000; i++) space.viewOf(i % 1000);
        should(space.viewCount).be.belowOrEqual(64 + 1);
    });

    it("honours a setter answering with a StatusCode object", () => {
        const objects = space.findNode("ns=0;i=85") as never;
        const v = space.addVariable({
            browseName: "Guarded",
            organizedBy: objects,
            dataType: "Double",
            value: { dataType: DataType.Double, value: 1 }
        });
        v.bindVariable({ set: () => StatusCodes.BadOutOfRange });
        const status = v.writeValue(new DataValue({ value: new Variant({ dataType: DataType.Double, value: 99 }) }));
        should(status).eql(StatusCodes.BadOutOfRange.value);
        should(v.readValue().value.value).eql(1, "the rejected value was not stored");
        v.bindVariable({ set: () => StatusCodes.Good });
        should(v.writeValue(new DataValue({ value: new Variant({ dataType: DataType.Double, value: 2 }) }))).eql(
            StatusCodes.Good.value
        );
        should(v.readValue().value.value).eql(2);
        v.bindVariable({ set: () => undefined });
        should(v.writeValue(new DataValue({ value: new Variant({ dataType: DataType.Double, value: 3 }) }))).eql(
            StatusCodes.Good.value
        );
    });

    it("stores and notifies a string getter's value only when it changes", () => {
        const objects = space.findNode("ns=0;i=85") as never;
        let text = "a";
        const v = space.addVariable({
            browseName: "Text",
            organizedBy: objects,
            dataType: "String",
            value: { get: () => new Variant({ dataType: DataType.String, value: text }) }
        });
        let notified = 0;
        v.on("value_changed", () => notified++);
        v.readValue();
        const version = v.valueVersion;
        v.readValue();
        v.readValue();
        should(notified).eql(1, "the first read stored the value, the next two found it unchanged");
        should(v.valueVersion).eql(version);
        text = "b";
        should(v.readValue().value.value).eql("b");
        should(notified).eql(2);
    });

    it("answers the mandatory and class attributes", () => {
        const objects = space.findNode("ns=0;i=85");
        should(objects?.readAttribute(null, AttributeIds.WriteMask).value.value).eql(0);
        should(objects?.readAttribute(null, AttributeIds.UserWriteMask).value.value).eql(0);
        const hasComponent = space.findNode("ns=0;i=47");
        should(hasComponent?.readAttribute(null, AttributeIds.Symmetric).value.value).eql(false);
        should(hasComponent?.readAttribute(null, AttributeIds.InverseName).value.value.text).eql("ComponentOf");
        const method = space.findNode("ns=0;i=11492"); // GetMonitoredItems
        // answered, and false: a Method of the store is executable once a function is bound to it
        should(method?.readAttribute(null, AttributeIds.Executable).value.value).eql(false);
        should(method?.readAttribute(null, AttributeIds.UserExecutable).value.value).eql(false);
        should(objects?.readAttribute(null, AttributeIds.Executable).statusCode).eql(StatusCodes.BadAttributeIdInvalid);
    });

    it("tells a view of a deleted node from the node that took its index", () => {
        const objects = space.findNode("ns=0;i=85") as never;
        const first = space.addVariable({
            nodeId: `ns=${ns};s=First`,
            browseName: "First",
            organizedBy: objects,
            dataType: "Double"
        });
        const index = first.index;
        space.deleteNode(first);
        should(first.isDisposed()).eql(true);
        const second = space.addVariable({
            nodeId: `ns=${ns};s=Second`,
            browseName: "Second",
            organizedBy: objects,
            dataType: "Int32"
        });
        should(second.index).eql(index, "the freed index");
        should(second.isDisposed()).eql(false);
        should(first.isDisposed()).eql(true, "the old view knows its node is gone");
        should(space.findNode(`ns=${ns};s=First`)).eql(null);
        should((space.findNode(`ns=${ns};s=Second`) as StoreVariableView).dataType.toString()).eql("ns=0;i=6");
    });

    it("leaves an extension object of a type it cannot decode unset rather than serving the fragment", () => {
        const document = `<?xml version="1.0" encoding="utf-8"?>
<UANodeSet xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
  <NamespaceUris><Uri>urn:test:fragment</Uri></NamespaceUris>
  <Models><Model ModelUri="urn:test:fragment" Version="1.0.0" PublicationDate="2026-01-01T00:00:00Z">
    <RequiredModel ModelUri="http://opcfoundation.org/UA/" Version="1.05.03"/></Model></Models>
  <UAVariable NodeId="ns=1;i=1" BrowseName="1:Thing" DataType="ns=1;i=100" ParentNodeId="i=85">
    <DisplayName>Thing</DisplayName>
    <References>
      <Reference ReferenceType="Organizes" IsForward="false">i=85</Reference>
      <Reference ReferenceType="HasTypeDefinition">i=68</Reference>
    </References>
    <Value><ExtensionObject><TypeId><Identifier>ns=1;i=101</Identifier></TypeId><Body><MyThing><A>1</A><B>two</B></MyThing></Body></ExtensionObject></Value>
  </UAVariable>
</UANodeSet>`;
        const other = new StoreAddressSpace({ expectedNodes: 8192 });
        const applier = new StoreRecordApplier(other.store, { indexOf: (uri) => other.namespaceIndexOf(uri) });
        return (async () => {
            for (const text of [readFileSync(nodesets.standard, "utf8"), document]) {
                for await (const record of xmlNodesetRecords([text])) applier.apply(record);
            }
            applier.finish();
            other.finishLoad();
            should(applier.deferredValueCount).eql(1);
            const range = other.findNode("ns=1;i=1") as StoreVariableView;
            const read = range.readValue();
            should(read.statusCode).eql(StatusCodes.BadWaitingForInitialData);
            should(read.value.dataType).eql(DataType.Null, "no fragment handed out");
        })();
    });
});
