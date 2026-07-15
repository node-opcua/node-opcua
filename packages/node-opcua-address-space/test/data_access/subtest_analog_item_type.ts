import { Range, standardUnits } from "node-opcua-data-access";
import { BrowseDirection, makeAccessLevelFlag } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { BrowseDescription } from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";

import { AddressSpace, type Namespace, SessionContext } from "../..";

export function subtest_analog_item_type(maintest: any): void {
    describe("AnalogDataItem", () => {
        let addressSpace: AddressSpace;
        let namespace: Namespace;
        before(() => {
            addressSpace = maintest.addressSpace;
            namespace = addressSpace.getOwnNamespace();
            should(addressSpace).be.instanceof(AddressSpace);
        });

        const context = SessionContext.defaultContext;

        it("should add an analog data item in the addresss_space", async () => {
            const objectsFolder = addressSpace.findNode("ObjectsFolder")!;
            objectsFolder.browseName.toString().should.eql("Objects");

            let fakeValue = 1;

            const analogItem = namespace.addAnalogDataItem({
                organizedBy: objectsFolder,

                browseName: "TemperatureSensor",
                definition: "(tempA -25) + tempB",
                valuePrecision: 0.5,

                engineeringUnits: standardUnits.degree_celsius,
                engineeringUnitsRange: { low: 100, high: 200 },

                instrumentRange: { low: -100, high: +200 },

                dataType: "Double",

                minimumSamplingInterval: 100,
                value: {
                    get: () => {
                        return new Variant({
                            dataType: DataType.Double,
                            value: fakeValue
                        });
                    }
                }
            });

            analogItem.accessLevel.should.eql(makeAccessLevelFlag("CurrentRead | CurrentWrite"));

            // xx console.log(JSON.stringify(analogItem,null," "));
            // analogItem.dataType.should.eql(addressSpace.findVariableType("AnalogItemType").nodeId);

            analogItem.definition?.browseName.toString().should.eql("Definition");
            analogItem.valuePrecision?.browseName.toString().should.eql("ValuePrecision");
            analogItem.euRange.browseName.toString().should.eql("EURange");
            analogItem.instrumentRange?.browseName.toString().should.eql("InstrumentRange");
            analogItem.engineeringUnits?.browseName.toString().should.eql("EngineeringUnits");

            // xx console.log("xxxx = analogItem.euRange.readValue().value.value", analogItem.euRange.readValue().toString());
            analogItem.euRange.readValue().value.value.low.should.eql(100);
            analogItem.euRange.readValue().value.value.high.should.eql(200);

            analogItem.instrumentRange?.readValue().value.value.low.should.eql(-100);
            analogItem.instrumentRange?.readValue().value.value.high.should.eql(200);

            // browsing variable
            const browseDescription = new BrowseDescription({
                browseDirection: BrowseDirection.Forward,
                nodeClassMask: 0, // 0 = all nodes
                referenceTypeId: 0,
                resultMask: 0x3f
            });
            const references = analogItem.browseNode(browseDescription);

            references.length.should.eql(6);

            const dataValue1 = await analogItem.instrumentRange?.readValueAsync(context);
            if (!dataValue1) {
                throw new Error("InstrumentRange should be defined");
            }
            dataValue1.statusCode.should.eql(StatusCodes.Good);
            dataValue1.value.dataType.should.eql(DataType.ExtensionObject);
            dataValue1.value.value.should.be.instanceOf(Range);
            dataValue1.value.value.low.should.eql(-100);
            dataValue1.value.value.high.should.eql(200);

            const dataValue2 = await analogItem.readValueAsync(context);
            dataValue2.statusCode.should.eql(StatusCodes.Good);
            dataValue2.value.dataType.should.eql(DataType.Double);
            dataValue2.value.value?.should.eql(fakeValue);

            fakeValue = 2.0;

            const dataValue3 = await analogItem.readValueAsync(context);
            dataValue3.statusCode.should.eql(StatusCodes.Good);
            dataValue3.value.dataType.should.eql(DataType.Double);
            dataValue3.value.value?.should.eql(fakeValue);
        });

        it("Writing a value exceeding InstrumentRange shall return BadOutOfRange and refuse to set the dataValue", async () => {
            const objectsFolder = addressSpace.rootFolder.objects;

            const analogItem = namespace.addAnalogDataItem({
                browseName: "TemperatureSensor",
                dataType: "Double",
                definition: "(tempA -25) + tempB",
                engineeringUnits: standardUnits.degree_celsius,
                engineeringUnitsRange: { low: -2000, high: 2000 },
                instrumentRange: { low: -100, high: 200 },
                organizedBy: objectsFolder,
                value: new Variant({ dataType: DataType.Double, value: 10.0 }),
                valuePrecision: 0.5
            });

            const dataValue = new DataValue({
                value: new Variant({ dataType: DataType.Double, value: -1000.0 }) // out of range
            });

            const statusCode = await analogItem.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.BadOutOfRange);

            const dataValue2 = await analogItem.readValueAsync(context);
            dataValue2.statusCode.should.eql(StatusCodes.Good);
            dataValue2.value.dataType.should.eql(DataType.Double);
            dataValue2.value.value?.should.eql(10.0);
        });

        it("Writing a value exceeding InstrumentRange shall return Good and adjust the StatusCode to BadOutOfRange if record", async () => {
            const objectsFolder = addressSpace.rootFolder.objects;

            const analogItem = namespace.addAnalogDataItem({
                browseName: "TemperatureSensor",
                dataType: "Double",
                definition: "(tempA -25) + tempB",
                engineeringUnits: standardUnits.degree_celsius,
                engineeringUnitsRange: { low: -2000, high: 2000 },
                instrumentRange: { low: -100, high: 200 },
                organizedBy: objectsFolder,
                value: new Variant({ dataType: DataType.Double, value: 10.0 }),
                valuePrecision: 0.5
            });
            analogItem.acceptValueOutOfRange = true;

            const dataValue = new DataValue({
                value: new Variant({ dataType: DataType.Double, value: -1000.0 }) // out of range
            });

            const statusCode = await analogItem.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.Good);

            const dataValue2 = await analogItem.readValueAsync(context);
            dataValue2.statusCode.should.eql(StatusCodes.BadOutOfRange);
            dataValue2.value.dataType.should.eql(DataType.Double);
            dataValue2.value.value?.should.eql(-1000.0);
        });

        it("Writing a value within InstrumentRange shall return Good", async () => {
            const objectsFolder = addressSpace.findNode("ObjectsFolder")!;

            const analogItem = namespace.addAnalogDataItem({
                browseName: "TemperatureSensor",
                dataType: "Double",
                definition: "(tempA -25) + tempB",
                engineeringUnits: standardUnits.degree_celsius,
                engineeringUnitsRange: { low: -2000, high: 2000 },
                instrumentRange: { low: -100, high: 200 },
                organizedBy: objectsFolder,
                value: new Variant({ dataType: DataType.Double, value: 10.0 }),
                valuePrecision: 0.5
            });

            const dataValue = new DataValue({
                value: new Variant({ dataType: DataType.Double, value: 150 }) // in range
            });

            const statusCode = await analogItem.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.Good);
        });

        it("should honor a typeDefinition that is a strict subtype of AnalogItemType and materialize its own mandatory members", () => {
            const analogItemType = addressSpace.findVariableType("AnalogItemType")!;

            // simulates a companion-specification VariableType derived from AnalogItemType,
            // with its own mandatory member (e.g. PADIM's ActualVolumeFlowRateVariableType / LowFlowCutOff)
            const myAnalogSubtype = namespace.addVariableType({
                browseName: "MyAnalogSubtype",
                subtypeOf: analogItemType
            });
            namespace.addVariable({
                browseName: "LowFlowCutOff",
                componentOf: myAnalogSubtype,
                dataType: "Double",
                modellingRule: "Mandatory"
            });

            const objectsFolder = addressSpace.rootFolder.objects;

            const analogItem = namespace.addAnalogDataItem({
                browseName: "MyAnalogSubtypeInstance",
                dataType: "Double",
                engineeringUnits: standardUnits.degree_celsius,
                engineeringUnitsRange: { low: 0, high: 100 },
                instrumentRange: { low: 0, high: 100 },
                organizedBy: objectsFolder,
                typeDefinition: myAnalogSubtype,
                value: new Variant({ dataType: DataType.Double, value: 10.0 })
            });

            // the HasTypeDefinition reference must point to the requested subtype, not AnalogItemType
            analogItem.typeDefinitionObj.nodeId.toString().should.eql(myAnalogSubtype.nodeId.toString());

            // the subtype's own mandatory member must have been instantiated
            const lowFlowCutOff = analogItem.getComponentByName("LowFlowCutOff");
            should.exist(lowFlowCutOff);

            // and the usual AnalogItemType members must still be there, with a single instance each
            analogItem.euRange.readValue().value.value.low.should.eql(0);
            analogItem.euRange.readValue().value.value.high.should.eql(100);
            analogItem.instrumentRange?.readValue().value.value.low.should.eql(0);
            analogItem.engineeringUnits?.readValue().value.value.displayName.text?.should.eql(
                standardUnits.degree_celsius.displayName?.text
            );

            const browseDescription = new BrowseDescription({
                browseDirection: BrowseDirection.Forward,
                nodeClassMask: 0,
                referenceTypeId: 0,
                resultMask: 0x3f
            });
            const references = analogItem.browseNode(browseDescription);
            references.filter((r) => r.browseName.name === "EURange").length.should.eql(1);
            references.filter((r) => r.browseName.name === "InstrumentRange").length.should.eql(1);
            references.filter((r) => r.browseName.name === "EngineeringUnits").length.should.eql(1);
        });

        it("should accept a typeDefinition passed as a NodeId, resolving it like the VariableType instance form", () => {
            const analogItemType = addressSpace.findVariableType("AnalogItemType")!;
            const myAnalogSubtype2 = namespace.addVariableType({
                browseName: "MyAnalogSubtype2",
                subtypeOf: analogItemType
            });

            const objectsFolder = addressSpace.rootFolder.objects;

            const analogItem = namespace.addAnalogDataItem({
                browseName: "MyAnalogSubtype2Instance",
                dataType: "Double",
                engineeringUnitsRange: { low: 0, high: 100 },
                organizedBy: objectsFolder,
                typeDefinition: myAnalogSubtype2.nodeId,
                value: new Variant({ dataType: DataType.Double, value: 10.0 })
            });

            analogItem.typeDefinitionObj.nodeId.toString().should.eql(myAnalogSubtype2.nodeId.toString());
        });

        it("should accept a typeDefinition passed as a browseName string (own-namespace form)", () => {
            const analogItemType = addressSpace.findVariableType("AnalogItemType")!;
            const myAnalogSubtype2b = namespace.addVariableType({
                browseName: "MyAnalogSubtype2b",
                subtypeOf: analogItemType
            });

            const objectsFolder = addressSpace.rootFolder.objects;

            const analogItem = namespace.addAnalogDataItem({
                browseName: "MyAnalogSubtype2bInstance",
                dataType: "Double",
                engineeringUnitsRange: { low: 0, high: 100 },
                organizedBy: objectsFolder,
                typeDefinition: `${namespace.index}:MyAnalogSubtype2b`,
                value: new Variant({ dataType: DataType.Double, value: 10.0 })
            });

            analogItem.typeDefinitionObj.nodeId.toString().should.eql(myAnalogSubtype2b.nodeId.toString());
        });

        it("should throw when typeDefinition is not a subtype of AnalogItemType", () => {
            const unrelatedType = namespace.addVariableType({
                browseName: "UnrelatedVariableType",
                subtypeOf: "BaseDataVariableType"
            });

            const objectsFolder = addressSpace.rootFolder.objects;

            should(() =>
                namespace.addAnalogDataItem({
                    browseName: "ShouldFail",
                    dataType: "Double",
                    engineeringUnitsRange: { low: 0, high: 100 },
                    organizedBy: objectsFolder,
                    typeDefinition: unrelatedType,
                    value: new Variant({ dataType: DataType.Double, value: 10.0 })
                })
            ).throw(/shall be a subtype of AnalogItemType/);
        });

        it("should instantiate only the mandatory members when a subtype is used without instrumentRange/engineeringUnits options", () => {
            const analogItemType = addressSpace.findVariableType("AnalogItemType")!;
            const myAnalogSubtype3 = namespace.addVariableType({
                browseName: "MyAnalogSubtype3",
                subtypeOf: analogItemType
            });
            namespace.addVariable({
                browseName: "LowFlowCutOff",
                componentOf: myAnalogSubtype3,
                dataType: "Double",
                modellingRule: "Mandatory"
            });

            const objectsFolder = addressSpace.rootFolder.objects;

            const analogItem = namespace.addAnalogDataItem({
                browseName: "MyAnalogSubtype3Instance",
                dataType: "Double",
                engineeringUnitsRange: { low: 0, high: 100 },
                organizedBy: objectsFolder,
                typeDefinition: myAnalogSubtype3,
                value: new Variant({ dataType: DataType.Double, value: 10.0 })
            });

            analogItem.typeDefinitionObj.nodeId.toString().should.eql(myAnalogSubtype3.nodeId.toString());
            should.exist(analogItem.getComponentByName("LowFlowCutOff"));

            analogItem.euRange.readValue().value.value.low.should.eql(0);
            should.not.exist(analogItem.instrumentRange);
            should.not.exist(analogItem.engineeringUnits);

            const browseDescription = new BrowseDescription({
                browseDirection: BrowseDirection.Forward,
                nodeClassMask: 0,
                referenceTypeId: 0,
                resultMask: 0x3f
            });
            const references = analogItem.browseNode(browseDescription);
            references.filter((r) => r.browseName.name === "EURange").length.should.eql(1);
        });
    });
}
