/**
 * OPC 10000-8 5.2 / OPC 10000-4 7.39: writing a Property that carries the semantics of a
 * DataItem has to make the DataItem's next notification carry the SemanticsChanged bit.
 *
 * Only DataItems built through addAnalogDataItem() / addTwoStateDiscrete() used to be wired
 * up, because the wiring was a listener installed by those helpers. These tests cover the
 * other ways a DataItem exists: instantiated from its VariableType, and assembled Property by
 * Property - which is the only way to build the ArrayItemType subtypes, and is what the CTT
 * Data Access Semantic Changes 013-017 scripts exercise.
 */
import { Range, standardUnits } from "node-opcua-data-access";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { WriteValue } from "node-opcua-service-write";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { AddressSpace, type IEventData, type Namespace, SessionContext, type UAVariable } from "../../dist/api/index.js";
import { generateAddressSpace } from "../../nodeJS.js";

const context = SessionContext.defaultContext;

async function writeProperty(property: UAVariable, value: Variant): Promise<void> {
    const statusCode = await property.writeAttribute(
        context,
        new WriteValue({ attributeId: AttributeIds.Value, value: new DataValue({ value }) })
    );
    should(statusCode.isGood()).eql(true, `write of ${property.browseName.toString()} failed: ${statusCode.toString()}`);
}

const range = (low: number, high: number) => new Variant({ dataType: DataType.ExtensionObject, value: new Range({ low, high }) });

describe("SemanticsChanged: the DataItem of a semantics-bearing Property", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        namespace = addressSpace.getOwnNamespace();
    });
    after(async () => {
        await addressSpace.shutdown();
        addressSpace.dispose();
    });

    it("SC1 bumps semantic_version when EURange is written on an addAnalogDataItem() item", async () => {
        const analog = namespace.addAnalogDataItem({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "SC1_Analog",
            engineeringUnits: standardUnits.degree_celsius,
            engineeringUnitsRange: { low: -100, high: 100 },
            instrumentRange: { low: -200, high: 200 },
            dataType: "Double",
            value: { dataType: DataType.Double, value: 1 }
        }) as unknown as UAVariable;

        const before = analog.semantic_version;
        await writeProperty(analog.getPropertyByName("EURange") as UAVariable, range(-50, 50));
        // exactly one bump: the generic wiring must not double up with a per-property listener
        should(analog.semantic_version).eql(before + 1);

        await writeProperty(analog.getPropertyByName("InstrumentRange") as UAVariable, range(-150, 150));
        should(analog.semantic_version).eql(before + 2);
    });

    it("SC2 bumps semantic_version when EURange is written on an instantiated AnalogItemType", async () => {
        const analogItemType = addressSpace.findVariableType("AnalogItemType")!;
        const analog = analogItemType.instantiate({
            browseName: "SC2_Analog",
            organizedBy: addressSpace.rootFolder.objects,
            dataType: "Double",
            optionals: ["InstrumentRange", "EngineeringUnits"]
        }) as unknown as UAVariable;
        analog.setValueFromSource(new Variant({ dataType: DataType.Double, value: 1 }));

        const euRange = analog.getPropertyByName("EURange") as UAVariable;
        should.exist(euRange);
        // the instantiated Property is read-only by default; the CTT writes it
        euRange.accessLevel = 3;
        euRange.userAccessLevel = 3;
        euRange.setValueFromSource(range(0, 100));

        const before = analog.semantic_version;
        await writeProperty(euRange, range(0, 90));
        should(analog.semantic_version).eql(before + 1);
    });

    it("SC3 bumps semantic_version when a hand-built ArrayItemType Property is written", async () => {
        // how the ArrayItemType subtypes have to be built: instantiate() refuses a ValueRank that
        // differs from the type's, so the Properties are added one by one after the Variable.
        const arrayItem = namespace.addVariable({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "SC3_YArrayItem",
            typeDefinition: "YArrayItemType",
            dataType: "Double",
            valueRank: 1,
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite",
            value: new Variant({ dataType: DataType.Double, arrayType: VariantArrayType.Array, value: [1, 2, 3] })
        }) as unknown as UAVariable;

        const property = (browseName: string, dataType: string, value: Variant) =>
            namespace.addVariable({ propertyOf: arrayItem, browseName, dataType, value }) as unknown as UAVariable;

        const title = property("Title", "LocalizedText", new Variant({ dataType: DataType.LocalizedText, value: { text: "t" } }));
        const euRange = property("EURange", "Range", range(0, 100));

        let expected = arrayItem.semantic_version;
        await writeProperty(euRange, range(0, 90));
        should(arrayItem.semantic_version).eql(++expected);

        await writeProperty(title, new Variant({ dataType: DataType.LocalizedText, value: { text: "CTTt" } }));
        should(arrayItem.semantic_version).eql(++expected);
    });

    it("SC4 bumps semantic_version when TrueState is written on a TwoStateDiscrete", async () => {
        const twoState = namespace.addTwoStateDiscrete({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "SC4_TwoState",
            trueState: "Open",
            falseState: "Closed",
            value: false
        }) as unknown as UAVariable;

        const before = twoState.semantic_version;
        await writeProperty(
            twoState.getPropertyByName("TrueState") as UAVariable,
            new Variant({ dataType: DataType.LocalizedText, value: { text: "Opened" } })
        );
        should(twoState.semantic_version).eql(before + 1);
    });

    it("SC5 leaves semantic_version alone when the DataItem's own value changes", async () => {
        const analog = namespace.addAnalogDataItem({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "SC5_Analog",
            engineeringUnits: standardUnits.degree_celsius,
            engineeringUnitsRange: { low: -100, high: 100 },
            dataType: "Double",
            value: { dataType: DataType.Double, value: 1 }
        }) as unknown as UAVariable;

        const before = analog.semantic_version;
        analog.setValueFromSource(new Variant({ dataType: DataType.Double, value: 42 }));
        should(analog.semantic_version).eql(before);
    });

    it("SC6 leaves semantic_version alone for a same-named Property of a plain variable", async () => {
        const plain = namespace.addVariable({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "SC6_Plain",
            dataType: "Double",
            value: new Variant({ dataType: DataType.Double, value: 1 })
        }) as unknown as UAVariable;
        const title = namespace.addVariable({
            propertyOf: plain,
            browseName: "Title",
            dataType: "LocalizedText",
            value: new Variant({ dataType: DataType.LocalizedText, value: { text: "t" } })
        }) as unknown as UAVariable;

        const before = plain.semantic_version;
        await writeProperty(title, new Variant({ dataType: DataType.LocalizedText, value: { text: "other" } }));
        should(plain.semantic_version).eql(before);
    });

    /**
     * OPC 10000-5 6.4.31: the Server also reports a semantics change as a SemanticChangeEventType
     * on the Server object, naming the affected Node and its TypeDefinition. CTT Base Info
     * SemanticChange 001 subscribes to the Server's events and to the DataItem, writes EURange and
     * expects both the event and the stamped data change.
     */
    it("SC7 raises a SemanticChangeEventType on the Server object naming the affected DataItem", async () => {
        const analog = namespace.addAnalogDataItem({
            organizedBy: addressSpace.rootFolder.objects,
            browseName: "SC7_Analog",
            engineeringUnits: standardUnits.degree_celsius,
            engineeringUnitsRange: { low: -100, high: 100 },
            instrumentRange: { low: -200, high: 200 },
            dataType: "Double",
            value: { dataType: DataType.Double, value: 1 }
        }) as unknown as UAVariable;

        const server = addressSpace.rootFolder.objects.server;
        const semanticChangeEventTypeNodeId = addressSpace.findEventType("SemanticChangeEventType")!.nodeId;
        const raised: Record<string, { value?: unknown }>[] = [];
        const onEvent = (eventData: IEventData): void => {
            raised.push(eventData as unknown as Record<string, { value?: unknown }>);
        };
        server.on("event", onEvent);
        try {
            await writeProperty(analog.getPropertyByName("EURange")!, range(-50, 50));
        } finally {
            server.removeListener("event", onEvent);
        }

        const semanticEvents = raised.filter(
            (eventData) => String(eventData.eventType?.value) === semanticChangeEventTypeNodeId.toString()
        );
        should(semanticEvents.length).eql(1, "exactly one SemanticChangeEventType per semantics change");

        const changes = semanticEvents[0].changes?.value as { affected: unknown; affectedType: unknown }[];
        should(changes.length).eql(1);
        should(String(changes[0].affected)).eql(analog.nodeId.toString());
        should(String(changes[0].affectedType)).eql(analog.typeDefinitionObj.nodeId.toString());
    });
});
