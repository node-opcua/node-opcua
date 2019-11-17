// tslint:disable:no-bitwise
import * as should from "should";

import { AccessLevelFlag } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";
import {
    AddressSpace,
    Namespace,
    SessionContext,
    UAMultiStateDiscrete,
    UAMultiStateValueDiscrete,
    UAObject,
    UAObjectType
} from "../..";
import { InstantiateObjectOptions } from "../..";

const context = new SessionContext();

export function subtest_multi_state_value_discrete_type(maintest: any) {


    describe("MultiStateValueDiscreteType", () => {

        let addressSpace: AddressSpace;
        let namespace: Namespace;
        before(() => {
            addressSpace = maintest.addressSpace;
            namespace = addressSpace.getOwnNamespace();

            should(addressSpace).be.instanceof(AddressSpace);
        });

        it("MultiStateValueDiscreteType should not be abstract", () => {

            const multiStateValueDiscreteType = addressSpace.findVariableType("MultiStateValueDiscreteType")!;
            multiStateValueDiscreteType.isAbstract.should.eql(false);

        });

        it("should add a MultiStateValueDiscreteType variable - form 1", () => {

            const objectsFolder = addressSpace.rootFolder.objects;

            const prop = namespace.addMultiStateValueDiscrete({
                browseName: "MyMultiStateValueVariable",
                enumValues: { Red: 0xFF0000, Orange: 0xFF9933, Green: 0x00FF00, Blue: 0x0000FF },
                organizedBy: objectsFolder,
                value: 0xFF0000 // Red
            });
            prop.browseName.toString().should.eql("1:MyMultiStateValueVariable");

            prop.valueRank.should.eql(-1); // ValueRank=Scalar

            const v = prop.getPropertyByName("EnumValues")!.readValue().value;
            v.dataType.should.eql(DataType.ExtensionObject);
            v.arrayType.should.eql(VariantArrayType.Array);
            v.value.length.should.eql(4);
            v.value[0].constructor.name.should.eql("EnumValueType");
            // xx .should.eql("Variant(Array<LocalizedText>, l= 3,
            // value=[locale=null text=Red,locale=null text=Orange,locale=null text=Green])");

            prop.readValue().value.toString().should.eql("Variant(Scalar<UInt32>, value: 16711680)");
            prop.readValue().value.dataType.should.eql(DataType.UInt32);

            prop.valueAsText.readValue().value.value.text!.should.eql("Red");

        });
        it("should add a MultiStateValueDiscreteType variable - form 2", () => {

            const objectsFolder = addressSpace.rootFolder.objects;

            const prop = namespace.addMultiStateValueDiscrete({
                browseName: "MyMultiStateValueVariable",
                enumValues: [
                    { displayName: "Red", value: 0xFF0000 },
                    { displayName: "Orange", value: 0xFF9933 },
                    { displayName: "Green", value: 0x00FF00 },
                    { displayName: "Blue", value: 0x0000FF }
                ],
                organizedBy: objectsFolder,
                value: 0xFF0000 // Red
            });
        });
        describe("edge case tests", () => {

            let multiStateValue: UAMultiStateValueDiscrete;
            before(() => {
                const objectsFolder = addressSpace.rootFolder.objects;
                multiStateValue = namespace.addMultiStateValueDiscrete({
                    browseName: "MyMultiStateValueVariable",
                    enumValues: {
                        Blue: 0x0000FF,
                        Green: 0x00FF00,
                        Orange: 0xFF9933,
                        Red: 0xFF0000
                    },
                    organizedBy: objectsFolder,
                    value: 0xFF0000 // Red
                });

            });

            it("writing a value not in the EnumValues map shall return BadOutOfRange", async () => {

                const dataValue = new DataValue({
                    value: new Variant({ dataType: DataType.UInt32, value: 100 })// out of range
                });
                const statusCode = await multiStateValue.writeValue(context, dataValue);
                statusCode.should.eql(StatusCodes.BadOutOfRange);
            });

            it("writing a value within EnumValues shall return Good", async () => {

                const dataValue = new DataValue({
                    value: new Variant({ dataType: DataType.UInt32, value: 0x0000FF })// OK
                });

                const statusCode = await multiStateValue.writeValue(context, dataValue);

                statusCode.should.eql(StatusCodes.Good);

                // Xx console.log(  multiStateValue.readValue().toString());
                // Xx console.log(  multiStateValue.valueAsText.readValue().toString());

                multiStateValue.valueAsText.readValue().value.value.text!.should.eql("Blue");

            });

            it("changing MultiStateVariable value shall change valueAsText accordingly", async () => {


                const dataValue0 = new DataValue({
                    value: new Variant({ dataType: DataType.UInt32, value: 0x0000FF })// OK
                });

                const statusCode0 = await multiStateValue.writeValue(context, dataValue0);

                const dataValue = new DataValue({
                    value: new Variant({
                        dataType: DataType.UInt32,
                        value: 0x00FF00
                    })// OK
                });
                const statusCode = await multiStateValue.writeValue(context, dataValue);

                // await new Promise((resolve) => setTimeout(resolve, 100));

                statusCode.should.eql(StatusCodes.Good);
                multiStateValue.valueAsText.readValue().value.value.text!.should.eql("Green");
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
            const multiStateValue = namespace.addMultiStateValueDiscrete({
                browseName: "Color",
                componentOf: myObjectType,
                enumValues: { Red: 0xFF0000, Orange: 0xFF9933, Green: 0x00FF00, Blue: 0x0000FF },
                modellingRule: "Mandatory",
                value: 0xFF0000 // Red,
            });

            should.exist(myObjectType.getComponentByName("Color"));

            myObjectType.color.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
            // add

            // instanciate  the type
            const obj = myObjectType.instantiate({
                browseName: "MyObject"
            }) as MyObjectWithMultiStateValueDiscrete;

            // verification
            obj.color.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
            obj.color.valueAsText.readValue().value.value.text!.should.eql("Red");
            obj.color.readValue().value.value.should.eql(0xFF0000);

            obj.color.enumValues.readValue().value.value[0].displayName.text!.should.eql("Red");
            obj.color.enumValues.readValue().value.value[1].displayName.text!.should.eql("Orange");
            obj.color.enumValues.readValue().value.value[2].displayName.text!.should.eql("Green");
            obj.color.enumValues.readValue().value.value[3].displayName.text!.should.eql("Blue");

            const greenValue = obj.color.enumValues.readValue().value.value[2].value[1];
            // now change the value => verify that valueAsText will change accordingly
            const dataValue = new DataValue({
                sourceTimestamp: new Date(),
                value: new Variant({ dataType: DataType.UInt32, value: greenValue })// OK
            });

            const statusCode = await obj.color.writeValue(context, dataValue);
            statusCode.should.eql(StatusCodes.Good);

            // now verify that valueAsText has been updated accordingly...
            obj.color.valueAsText.readValue().value.value.text!.should.eql("Green");
        });

    });
}
