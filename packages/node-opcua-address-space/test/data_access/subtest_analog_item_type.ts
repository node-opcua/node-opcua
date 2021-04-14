"use strict";
import * as async from "async";
import * as should from "should";

import { Range } from "node-opcua-data-access";
import { standardUnits } from "node-opcua-data-access";
import { BrowseDirection, makeAccessLevelFlag } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { BrowseDescription } from "node-opcua-service-browse";
import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";

import { AddressSpace, Namespace, SessionContext } from "../..";

export function subtest_analog_item_type(maintest: any) {

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

            analogItem.definition!.browseName.toString().should.eql("Definition");
            analogItem.valuePrecision!.browseName.toString().should.eql("ValuePrecision");
            analogItem.euRange.browseName.toString().should.eql("EURange");
            analogItem.instrumentRange!.browseName.toString().should.eql("InstrumentRange");
            analogItem.engineeringUnits.browseName.toString().should.eql("EngineeringUnits");

            // xx console.log("xxxx = analogItem.euRange.readValue().value.value", analogItem.euRange.readValue().toString());
            analogItem.euRange.readValue().value.value.low.should.eql(100);
            analogItem.euRange.readValue().value.value.high.should.eql(200);

            analogItem.instrumentRange!.readValue().value.value.low.should.eql(-100);
            analogItem.instrumentRange!.readValue().value.value.high.should.eql(200);

            // browsing variable
            const browseDescription = new BrowseDescription({
                browseDirection: BrowseDirection.Forward,
                nodeClassMask: 0, // 0 = all nodes
                referenceTypeId: 0,
                resultMask: 0x3F
            });
            // xx var browseResult = engine.browseSingleNode(analogItem.nodeId, browseDescription);
            const references = analogItem.browseNode(browseDescription);

            references.length.should.eql(6);

            const dataValue1 = await analogItem.instrumentRange!.readValueAsync(context);
            dataValue1.statusCode.should.eql(StatusCodes.Good);
            dataValue1.value.dataType.should.eql(DataType.ExtensionObject);
            dataValue1.value.value.should.be.instanceOf(Range);
            dataValue1.value.value.low.should.eql(-100);
            dataValue1.value.value.high.should.eql(200);

            const dataValue2 = await analogItem.readValueAsync(context);
            dataValue2.statusCode.should.eql(StatusCodes.Good);
            dataValue2.value.dataType.should.eql(DataType.Double);
            dataValue2.value.value.should.eql(fakeValue);

            fakeValue = 2.0;

            const dataValue3 = await analogItem.readValueAsync(context);
            dataValue3.statusCode.should.eql(StatusCodes.Good);
            dataValue3.value.dataType.should.eql(DataType.Double);
            dataValue3.value.value.should.eql(fakeValue);
        });

        it("Writing a value exceeding InstrumentRange shall return BadOutOfRange", async () => {

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
                valuePrecision: 0.5,
            });

            const dataValue = new DataValue({
                value: new Variant({ dataType: DataType.Double, value: -1000.0 })// out of range
            });

            const statusCode = await analogItem.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.BadOutOfRange);

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
                valuePrecision: 0.5,
            });

            const dataValue = new DataValue({
                value: new Variant({ dataType: DataType.Double, value: 150 })// in range
            });

            const statusCode = await analogItem.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.Good);

        });
    });
}
