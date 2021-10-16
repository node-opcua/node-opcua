import * as should from "should";
import * as sinon from "sinon";

import { Range, standardUnits } from "node-opcua-data-access";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { WriteValue } from "node-opcua-service-write";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";

import { AddressSpace, SessionContext } from "../..";
import { UAAnalogItem } from "../..";

const context = SessionContext.defaultContext;

async function modifyEURange<T, DT extends DataType>(analogItem: UAAnalogItem<T, DT>) {
    const dataValueOrg = analogItem.readAttribute(context, AttributeIds.Value);

    const dataValue = new DataValue({
        value: {
            dataType: DataType.ExtensionObject,
            value: new Range({
                high: dataValueOrg.value.value.high + 1,
                low: dataValueOrg.value.value.low + 1
            })
        }
    });

    const writeValue = new WriteValue({
        attributeId: AttributeIds.Value,
        value: dataValue
    });

    await analogItem.euRange.writeAttribute(context, writeValue);
}

export function subtest_analog_item_semantic_changed(maintest: any): void {
    describe("AnalogDataItem and semantic changes", () => {
        let addressSpace: AddressSpace;
        let analogItem: UAAnalogItem<number, DataType.Double>;
        beforeEach(() => {
            addressSpace = maintest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);

            const objectsFolder = addressSpace.rootFolder.objects;
            objectsFolder.browseName.toString().should.eql("Objects");

            const fakeValue = 1;

            analogItem = addressSpace.getOwnNamespace().addAnalogDataItem({
                organizedBy: objectsFolder,

                browseName: "TemperatureSensor1",
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
        });

        it("should increase semantic_version when EURange changes", async () => {
            analogItem.semantic_version.should.eql(0);
            const original_semantic_version = analogItem.semantic_version;
            await modifyEURange(analogItem);
            analogItem.semantic_version.should.eql(original_semantic_version + 1);
        });

        it("should increase 'semantic_' event when EURange changes", async () => {
            analogItem.semantic_version.should.eql(0);

            const spy_on_semantic_changed = sinon.spy();
            analogItem.on("semantic_changed", spy_on_semantic_changed);

            const original_semantic_version = analogItem.semantic_version;
            await modifyEURange(analogItem);
            spy_on_semantic_changed.callCount.should.eql(1);
            analogItem.semantic_version.should.eql(original_semantic_version + 1);
        });
        it("should not emit a 'semantic_changed' event when value changes", async () => {
            analogItem.semantic_version.should.eql(0);
            const original_semantic_version = analogItem.semantic_version;

            const spy_on_semantic_changed = sinon.spy();
            analogItem.on("semantic_changed", spy_on_semantic_changed);

            const dataValue = analogItem.readValue();
            await analogItem.writeValue(context, dataValue);
            analogItem.semantic_version.should.eql(original_semantic_version);
            spy_on_semantic_changed.callCount.should.eql(0);
        });
    });
}
