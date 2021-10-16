import * as should from "should";

import { AxisInformation, AxisScaleEnumeration, standardUnits } from "node-opcua-data-access";
import { coerceLocalizedText } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";

import { AddressSpace, UAFolder, Namespace } from "../..";

export function subtest_Y_array_item_type(maintest: any): void {
    describe("YArrayItemType", () => {
        let addressSpace: AddressSpace;
        let namespace: Namespace;

        before(() => {
            addressSpace = maintest.addressSpace;
            namespace = addressSpace.getOwnNamespace();
            should(addressSpace).be.instanceof(AddressSpace);
        });

        let objectsFolder: UAFolder;
        before(() => {
            objectsFolder = addressSpace.findNode("ObjectsFolder")! as UAFolder;
            objectsFolder.browseName.toString().should.eql("Objects");
        });

        it("YArrayItemType should not be abstract", () => {
            const YArrayItemType = addressSpace.findVariableType("YArrayItemType")!;
            YArrayItemType.isAbstract.should.eql(false);
        });

        it("should add a YArrayItem", () => {
            const yArrayItem = namespace.addYArrayItem({
                organizedBy: objectsFolder,

                browseName: "MyYArrayItem",

                title: "My Little YArray Item",

                engineeringUnits: standardUnits.degree_celsius,
                engineeringUnitsRange: { low: 100, high: 200 },

                axisScaleType: "Log",

                xAxisDefinition: {
                    axisScaleType: AxisScaleEnumeration.Linear,
                    axisSteps: [0, 25, 50, 75, 100],
                    engineeringUnits: standardUnits.second,
                    euRange: { low: -10, high: 100 },
                    title: coerceLocalizedText("the X axis legend")
                },

                value: new Variant({
                    arrayType: VariantArrayType.Array,
                    dataType: DataType.Float,
                    value: [1, 2, 3, 2]
                })
            });

            yArrayItem.browseName.toString().should.eql("1:MyYArrayItem");

            yArrayItem.dataType.should.eql(resolveNodeId("Float"));

            yArrayItem.readValue().value.value.length.should.eql(4);
            yArrayItem.readValue().value.value[0].should.eql(1);
            yArrayItem.readValue().value.value[1].should.eql(2);
            yArrayItem.readValue().value.value[2].should.eql(3);
            yArrayItem.readValue().value.value[3].should.eql(2);

            Object.prototype.hasOwnProperty
                .call(yArrayItem, "instrumentRange")
                .should.eql(false, "optional instrument Range not expected");

            yArrayItem.euRange.readValue().value.value.low.should.eql(100);
            yArrayItem.euRange.readValue().value.value.high.should.eql(200);

            yArrayItem.title.readValue().value.value.text!.should.eql("My Little YArray Item");

            // access xAxisDefinition from extension object
            const x = yArrayItem.xAxisDefinition.readValue().value.value;

            x.engineeringUnits.should.eql(standardUnits.second);
            x.title!.text!.should.eql("the X axis legend");
            x.euRange.low.should.eql(-10);
            x.euRange.high.should.eql(100);

            // xx console.log("xxxx ",yArrayItem.xAxisDefinition.toString())
            // xx yArrayItem.xAxisDefinition.euRange.readValue().value.value.should.eql(standardUnits.second);
            // xx yArrayItem.xAxisDefinition.engineeringUnits.readValue().value.value.should.eql(standardUnits.second);
        });

        it("should add a YArrayItem with optional instrument range", () => {
            const prop = namespace.addYArrayItem({
                organizedBy: objectsFolder,

                title: "SomeTitle",

                browseName: "MyYArrayItem",

                engineeringUnits: standardUnits.degree_celsius,
                engineeringUnitsRange: { low: 100, high: 200 },
                instrumentRange: { low: -100, high: +200 },

                axisScaleType: "Linear",

                xAxisDefinition: {
                    axisScaleType: AxisScaleEnumeration.Linear,
                    axisSteps: [0, 25, 50, 75, 100],
                    engineeringUnits: standardUnits.second,
                    euRange: { low: 0, high: 100 },
                    title: coerceLocalizedText("the X axis legend")
                },

                value: new Variant({
                    arrayType: VariantArrayType.Array,
                    dataType: DataType.Float,
                    value: [1, 2, 3]
                })
            });

            prop.browseName.toString().should.eql("1:MyYArrayItem");

            prop.dataType.should.eql(resolveNodeId("Float"));

            prop.instrumentRange.readValue().value.value.low.should.eql(-100);
            prop.instrumentRange.readValue().value.value.high.should.eql(200);
        });
    });
}
