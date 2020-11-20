// tslint:disable:no-bitwise
import * as should from "should";

import { AccessLevelFlag } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";

import { AddressSpace, Namespace, SessionContext, UAMultiStateValueDiscrete, UAObject, UAObjectType } from "../..";

const context = new SessionContext();

export function subtest_multi_state_value_discrete_type(mainTest: { addressSpace: AddressSpace }) {
    describe("MultiStateValueDiscreteType", () => {
        let addressSpace: AddressSpace;
        let namespace: Namespace;
        before(() => {
            addressSpace = mainTest.addressSpace;
            namespace = addressSpace.getOwnNamespace();

            should(addressSpace).be.instanceof(AddressSpace);
        });

        it("MultiStateValueDiscreteType should not be abstract", () => {
            const multiStateValueDiscreteType = addressSpace.findVariableType("MultiStateValueDiscreteType")!;
            multiStateValueDiscreteType.isAbstract.should.eql(false);
        });

        it("should add a MultiStateValueDiscreteType variable - form 1", () => {
            const objectsFolder = addressSpace.rootFolder.objects;

            const multiStateDiscreteVariable = namespace.addMultiStateValueDiscrete({
                browseName: "MyMultiStateDiscreteValueVariable",
                enumValues: { Red: 0xff0000, Orange: 0xff9933, Green: 0x00ff00, Blue: 0x0000ff },
                organizedBy: objectsFolder,
                value: 0xff0000 // Red
            });
            multiStateDiscreteVariable.browseName.toString().should.eql("1:MyMultiStateDiscreteValueVariable");

            multiStateDiscreteVariable.valueRank.should.eql(-1); // ValueRank=Scalar

            const v = multiStateDiscreteVariable.getPropertyByName("EnumValues")!.readValue().value;
            v.dataType.should.eql(DataType.ExtensionObject);
            v.arrayType.should.eql(VariantArrayType.Array);
            v.value.length.should.eql(4);
            v.value[0].constructor.name.should.eql("EnumValueType");
            // xx .should.eql("Variant(Array<LocalizedText>, l= 3,
            // value=[locale=null text=Red,locale=null text=Orange,locale=null text=Green])");

            multiStateDiscreteVariable.readValue().value.toString().should.eql("Variant(Scalar<UInt32>, value: 16711680)");
            multiStateDiscreteVariable.readValue().value.dataType.should.eql(DataType.UInt32);

            multiStateDiscreteVariable.valueAsText.readValue().value.value.text!.should.eql("Red");
        });
        it("should add a MultiStateValueDiscreteType variable - form 2", () => {
            const objectsFolder = addressSpace.rootFolder.objects;

            const multiStateValueDiscreteVariable = namespace.addMultiStateValueDiscrete({
                browseName: "MyMultiStateValueVariable",
                enumValues: [
                    { displayName: "Red", value: 0xff0000 },
                    { displayName: "Orange", value: 0xff9933 },
                    { displayName: "Green", value: 0x00ff00 },
                    { displayName: "Blue", value: 0x0000ff }
                ],
                organizedBy: objectsFolder,
                value: 0xff0000 // Red
            });
            multiStateValueDiscreteVariable.getValueAsNumber().should.eql(0xff0000);
        });
        describe("edge case tests", () => {
            let multiStateValueDiscreteVariable: UAMultiStateValueDiscrete;
            before(() => {
                const objectsFolder = addressSpace.rootFolder.objects;
                multiStateValueDiscreteVariable = namespace.addMultiStateValueDiscrete({
                    browseName: "MyMultiStateValueVariable",
                    enumValues: {
                        Blue: 0x0000ff,
                        Green: 0x00ff00,
                        Orange: 0xff9933,
                        Red: 0xff0000
                    },
                    organizedBy: objectsFolder,
                    value: 0xff0000 // Red
                });
            });

            it("writing a value not in the EnumValues map shall return BadOutOfRange", async () => {
                const dataValue = new DataValue({
                    value: new Variant({ dataType: DataType.UInt32, value: 100 }) // out of range
                });
                const statusCode = await multiStateValueDiscreteVariable.writeValue(context, dataValue);
                statusCode.should.eql(StatusCodes.BadOutOfRange);
            });

            it("writing a value within EnumValues shall return Good", async () => {
                const dataValue = new DataValue({
                    value: new Variant({ dataType: DataType.UInt32, value: 0x0000ff }) // OK
                });

                const statusCode = await multiStateValueDiscreteVariable.writeValue(context, dataValue);

                statusCode.should.eql(StatusCodes.Good);

                // Xx console.log(  multiStateValue.readValue().toString());
                // Xx console.log(  multiStateValue.valueAsText.readValue().toString());

                multiStateValueDiscreteVariable.valueAsText.readValue().value.value.text!.should.eql("Blue");
            });

            it("changing MultiStateVariable value shall change valueAsText accordingly", async () => {
                const dataValue0 = new DataValue({
                    value: new Variant({ dataType: DataType.UInt32, value: 0x0000ff }) // OK
                });

                const statusCode0 = await multiStateValueDiscreteVariable.writeValue(context, dataValue0);

                const dataValue = new DataValue({
                    value: new Variant({
                        dataType: DataType.UInt32,
                        value: 0x00ff00
                    }) // OK
                });
                const statusCode = await multiStateValueDiscreteVariable.writeValue(context, dataValue);

                // await new Promise((resolve) => setTimeout(resolve, 100));

                statusCode.should.eql(StatusCodes.Good);
                multiStateValueDiscreteVariable.valueAsText.readValue().value.value.text!.should.eql("Green");
            });

            it("UAMultiStateValueDiscreteVariable#setValue - 1", () => {
                multiStateValueDiscreteVariable.setValue("Orange");
                multiStateValueDiscreteVariable.getValueAsString().should.eql("Orange");
                multiStateValueDiscreteVariable.getValueAsNumber().should.eql(0xff9933);
            });
            it("UAMultiStateValueDiscreteVariable#setValue - 2", () => {
                multiStateValueDiscreteVariable.setValue(0x0000ff);
                multiStateValueDiscreteVariable.getValueAsString().should.eql("Blue");
                multiStateValueDiscreteVariable.getValueAsNumber().should.eql(0x0000ff);
            });
        });

        interface MyObjectWithMultiStateValueDiscreteType extends UAObjectType {
            color: UAMultiStateValueDiscrete;
            // instantiate(options: InstantiateObjectOptions): MyObjectWithMultiStateValueDiscrete;
        }

        interface MyObjectWithMultiStateValueDiscrete extends UAObject {
            color: UAMultiStateValueDiscrete;
        }

        it("ZZ2 should instantiate a DataType containing a MultiStateValueDiscreteType", async () => {
            // create a new DataType
            const myObjectType = namespace.addObjectType({
                browseName: "MyObjectWithMultiStateValueDiscreteType"
            }) as MyObjectWithMultiStateValueDiscreteType;

            namespace.addMultiStateValueDiscrete({
                browseName: "Color",
                componentOf: myObjectType,
                enumValues: { Red: 0xff0000, Orange: 0xff9933, Green: 0x00ff00, Blue: 0x0000ff },
                modellingRule: "Mandatory",
                value: 0xff0000 // Red,
            });

            should.exist(myObjectType.getComponentByName("Color"));

            myObjectType.color.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
            // add

            // instantiate  the type
            const obj = myObjectType.instantiate({
                browseName: "MyObject"
            }) as MyObjectWithMultiStateValueDiscrete;

            // verification
            obj.color.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
            obj.color.valueAsText.readValue().value.value.text!.should.eql("Red");
            obj.color.readValue().value.value.should.eql(0xff0000);

            obj.color.enumValues.readValue().value.value[0].displayName.text!.should.eql("Red");
            obj.color.enumValues.readValue().value.value[1].displayName.text!.should.eql("Orange");
            obj.color.enumValues.readValue().value.value[2].displayName.text!.should.eql("Green");
            obj.color.enumValues.readValue().value.value[3].displayName.text!.should.eql("Blue");

            const greenValue = obj.color.enumValues.readValue().value.value[2].value[1];
            // now change the value => verify that valueAsText will change accordingly
            const dataValue = new DataValue({
                sourceTimestamp: new Date(),
                value: new Variant({ dataType: DataType.UInt32, value: greenValue }) // OK
            });

            const statusCode = await obj.color.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.Good);

            // now verify that valueAsText has been updated accordingly...
            obj.color.valueAsText.readValue().value.value.text!.should.eql("Green");

            // it
            obj.color.setValue("Green");
            obj.color.getValueAsString().should.eql("Green");
            obj.color.valueAsText.readValue().value.value.text!.should.eql("Green");

            obj.color.setValue("Blue");
            obj.color.getValueAsString().should.eql("Blue");
            obj.color.valueAsText.readValue().value.value.text!.should.eql("Blue");
        });
    });
}
