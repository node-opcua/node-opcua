/**
 * Raising an event fills a layout computed once per event type. The layout must follow the type
 * hierarchy: a field added to the type, to a supertype or to a component of the type shows up in the
 * next event, a deleted one disappears, and the events keep answering select clauses by NodeId and
 * by browse path.
 */
import { DataType } from "node-opcua-basic-types";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import should from "should";
import {
    AddressSpace,
    type IEventData,
    type Namespace,
    type RaiseEventData,
    type UAEventType,
    type UAObject,
    type UAVariable
} from "../dist/api/index.js";
import { peekEventLayout } from "../dist/impl/event_layout.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

describe("Event layout cache", function (this: Mocha.Suite) {
    this.timeout(60000);

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let baseType: UAEventType;
    let eventType: UAEventType;
    let source: UAObject;
    let events: IEventData[];

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        namespace = addressSpace.registerNamespace("urn:event-layout");
        baseType = namespace.addEventType({ browseName: "LayoutBaseEventType", subtypeOf: "BaseEventType" });
        namespace.addVariable({ browseName: "BaseField", propertyOf: baseType, dataType: "Double", modellingRule: "Mandatory" });
        eventType = namespace.addEventType({ browseName: "LayoutEventType", subtypeOf: baseType });
        namespace.addVariable({ browseName: "OwnField", propertyOf: eventType, dataType: "String", modellingRule: "Mandatory" });
        const block = namespace.addObject({ browseName: "Block", componentOf: eventType, modellingRule: "Mandatory" });
        namespace.addVariable({ browseName: "Inner", propertyOf: block, dataType: "Int32", modellingRule: "Mandatory" });

        source = namespace.addObject({
            browseName: "LayoutSource",
            organizedBy: addressSpace.rootFolder.objects,
            eventNotifier: 1,
            notifierOf: addressSpace.rootFolder.objects.server
        });
        events = [];
        addressSpace.rootFolder.objects.server.on("event", (eventData) => events.push(eventData));
    });
    after(() => {
        addressSpace.dispose();
    });
    beforeEach(() => {
        events.length = 0;
    });

    const raise = (data: RaiseEventData): IEventData => {
        source.raiseEvent(eventType, data);
        should(events.length).eql(1);
        return events[0];
    };
    const field = (eventData: IEventData, name: string): Variant => (eventData as unknown as Record<string, Variant>)[name];
    const readByPath = (eventData: IEventData, path: string): Variant | null => {
        const browsePath = makeBrowsePath(eventType.nodeId, path);
        const result = eventData._browse(browsePath);
        should(result?.statusCode).eql(StatusCodes.Good);
        const targetId = result?.targets?.[0].targetId;
        should.exist(targetId);
        return eventData._readValue(targetId as unknown as Parameters<IEventData["_readValue"]>[0]);
    };

    it("fills the fields of the type, its supertypes and its components", () => {
        const e = raise({
            baseField: { dataType: DataType.Double, value: 1.5 },
            ownField: { dataType: DataType.String, value: "own" },
            "block.inner": { dataType: DataType.Int32, value: 42 }
        });
        should(field(e, "baseField").value).eql(1.5);
        should(field(e, "ownField").value).eql("own");
        should(field(e, "block.inner").value).eql(42);
        should(field(e, "message").dataType).eql(DataType.LocalizedText);
        should(field(e, "eventType").value.toString()).eql(eventType.nodeId.toString());
        should(readByPath(e, "/1:OwnField")?.value).eql("own");
        should(readByPath(e, "/1:Block/1:Inner")?.value).eql(42);
        // a field the caller did not give is present, and null
        should(field(e, "conditionClassId").dataType).eql(DataType.Null);
    });

    it("reuses the layout for the next event of the same type", () => {
        raise({ ownField: { dataType: DataType.String, value: "a" } });
        const layout = peekEventLayout(eventType);
        should.exist(layout);
        events.length = 0;
        const e2 = raise({ ownField: { dataType: DataType.String, value: "b" } });
        should(peekEventLayout(eventType)).equal(layout);
        should(field(e2, "ownField").value).eql("b");
        should(readByPath(e2, "/1:OwnField")?.value).eql("b");
    });

    it("rebuilds the layout when the event type gains a field", () => {
        raise({});
        const before = peekEventLayout(eventType);
        const added = namespace.addVariable({
            browseName: "LateField",
            propertyOf: eventType,
            dataType: "Boolean",
            modellingRule: "Optional"
        });
        events.length = 0;
        const e = raise({ lateField: { dataType: DataType.Boolean, value: true } });
        should(peekEventLayout(eventType)).not.equal(before);
        should(field(e, "lateField").value).eql(true);
        should(e._readValue(added.nodeId)?.value).eql(true);
    });

    it("rebuilds the layout when a supertype gains a field", () => {
        raise({});
        namespace.addVariable({
            browseName: "LateBaseField",
            propertyOf: baseType,
            dataType: "Double",
            modellingRule: "Mandatory"
        });
        events.length = 0;
        const e = raise({ lateBaseField: { dataType: DataType.Double, value: 2.5 } });
        should(field(e, "lateBaseField").value).eql(2.5);
    });

    it("rebuilds the layout when a component of the type gains an aggregate", () => {
        raise({});
        const block = eventType.getComponentByName("Block") as UAObject;
        namespace.addVariable({ browseName: "LateInner", propertyOf: block, dataType: "String", modellingRule: "Mandatory" });
        events.length = 0;
        const e = raise({ "block.lateInner": { dataType: DataType.String, value: "late" } });
        should(field(e, "block.lateInner").value).eql("late");
        should(readByPath(e, "/1:Block/1:LateInner")?.value).eql("late");
    });

    it("drops a field whose node is deleted", () => {
        const late = eventType.getPropertyByName("LateField") as UAVariable;
        should.exist(late);
        raise({});
        namespace.deleteNode(late);
        events.length = 0;
        const e = raise({});
        should(field(e, "lateField")).eql(undefined);
        should(e._readValue(late.nodeId)).eql(null);
        should(field(e, "ownField").dataType).eql(DataType.Null);
    });

    it("lets a field without a modelling rule in once it gets one", () => {
        const optional = namespace.addVariable({ browseName: "NoRule", propertyOf: eventType, dataType: "Double" });
        const e1 = raise({});
        should(field(e1, "noRule")).eql(undefined);
        optional.addReference({ referenceType: "HasModellingRule", nodeId: "i=78" /* Mandatory */ });
        events.length = 0;
        const e2 = raise({ noRule: { dataType: DataType.Double, value: 7 } });
        should(field(e2, "noRule").value).eql(7);
    });

    it("keeps the value of a field given as a Variant, and coerces plain objects", () => {
        const given = new Variant({ dataType: DataType.String, value: "as variant" });
        const e = raise({ ownField: given, baseField: { dataType: DataType.Double, value: 3 } });
        should(field(e, "ownField")).equal(given);
        should(field(e, "baseField")).be.instanceOf(Variant);
    });
});
