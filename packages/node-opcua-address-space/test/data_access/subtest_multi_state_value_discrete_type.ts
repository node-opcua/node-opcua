// tslint:disable:no-bitwise
import should from "should";
import sinon from "sinon";

import { AccessLevelFlag } from "node-opcua-data-model";
import { DataValue, DataValueOptionsT, DataValueT } from "node-opcua-data-value";
import { CallbackT, StatusCode, StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";
import { getCurrentClock } from "node-opcua-date-time";
import { EnumValueType } from "node-opcua-types";
import { Int64, coerceInt32, coerceInt64, coerceInt8, coerceUInt32, coerceUInt64, coerceUInt8 } from "node-opcua-basic-types";

import {
    AddressSpace,
    EnumValueTypeOptionsLike,
    Namespace,
    SessionContext,
    UAMultiStateValueDiscreteArrayEx,
    UAObject,
    UAObjectType
} from "../..";
import { UAMultiStateValueDiscreteEx } from "../..";

const context = new SessionContext();

export function subtest_multi_state_value_discrete_type(mainTest: { addressSpace: AddressSpace }): void {
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

            const multiStateDiscreteVariable = namespace.addMultiStateValueDiscrete<number, DataType.UInt32>({
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

        it("ZZ3 should create a MultiStateValueDiscreteType with value getter/setter", async () => {
            const namespace = addressSpace.getOwnNamespace();

            let _theValue = 0xff0000; // Red

            const timestamped_get_raw = (callback: CallbackT<DataValue>) => {
                // using getCurrentClock will guaranty that clock value is different each time
                const clock = getCurrentClock();
                setTimeout(() => {
                    const myDataValue = new DataValue({
                        serverPicoseconds: clock.picoseconds,
                        serverTimestamp: clock.timestamp,
                        sourcePicoseconds: clock.picoseconds,
                        sourceTimestamp: clock.timestamp,
                        statusCode: StatusCodes.Good,
                        value: { dataType: DataType.UInt32, value: _theValue }
                    });
                    callback(null, myDataValue);
                }, 10); //simulate some delay
            };
            const timestamped_set_raw = (dataValue: DataValue, callback: CallbackT<StatusCode>) => {
                if (dataValue.value.dataType !== DataType.UInt32) {
                    return callback(new Error("Invalid DataType"));
                }
                setTimeout(() => {
                    _theValue = dataValue.value.value;
                    callback(null, StatusCodes.Good);
                }, 10);
            };
            const timestamped_set = sinon.spy(timestamped_set_raw);
            const timestamped_get = sinon.spy(timestamped_get_raw);

            const multiStateDiscreteValueVariable = namespace.addMultiStateValueDiscrete({
                browseName: "MultiStateDiscreteValueVariableWithGetterAndSetter",
                organizedBy: addressSpace.rootFolder.objects,
                enumValues: [
                    { displayName: "Red", value: 0xff0000 },
                    { displayName: "Orange", value: 0xff9933 },
                    { displayName: "Green", value: 0x00ff00 },
                    { displayName: "Blue", value: 0x0000ff }
                ],
                minimumSamplingInterval: 100,
                value: {
                    timestamped_get,
                    timestamped_set
                }
            });

            // because we use getter and setter, we need to call at least readValueAsync once
            // to get the initial value....
            const dv0 = await multiStateDiscreteValueVariable.readValueAsync(SessionContext.defaultContext);

            multiStateDiscreteValueVariable.getValueAsNumber().should.eql(0xff0000);
            multiStateDiscreteValueVariable.readValue().statusCode.should.eql(StatusCodes.Good);
            multiStateDiscreteValueVariable.getValueAsString().should.eql("Red");
            // ----------------

            _theValue = 0x00ff00;
            const dv1 = await multiStateDiscreteValueVariable.readValueAsync(SessionContext.defaultContext);
            multiStateDiscreteValueVariable.getValueAsString().should.eql("Green");
            //
            _theValue = 0xff9933;
            await multiStateDiscreteValueVariable.readValueAsync(SessionContext.defaultContext);
            multiStateDiscreteValueVariable.getValueAsString().should.eql("Orange");
            //

            // external write
            const clock = getCurrentClock();
            await multiStateDiscreteValueVariable.writeValue(
                SessionContext.defaultContext,
                new DataValue({
                    serverPicoseconds: clock.picoseconds,
                    serverTimestamp: clock.timestamp,
                    sourcePicoseconds: clock.picoseconds,
                    sourceTimestamp: clock.timestamp,
                    statusCode: StatusCodes.Good,
                    value: { dataType: DataType.UInt32, value: 0x0000ff }
                })
            );

            multiStateDiscreteValueVariable.getValueAsString().should.eql("Blue");
            timestamped_set.callCount.should.eql(1);
            timestamped_get.callCount.should.eql(3);

            /// now trying with invalid values to see how
            const sc1 = await multiStateDiscreteValueVariable.writeValue(
                SessionContext.defaultContext,
                new DataValue({
                    serverPicoseconds: clock.picoseconds,
                    serverTimestamp: clock.timestamp,
                    sourcePicoseconds: clock.picoseconds,
                    sourceTimestamp: clock.timestamp,
                    statusCode: StatusCodes.Good,
                    value: { dataType: DataType.UInt32, value: 0xaaaaaa }
                })
            );
            multiStateDiscreteValueVariable.getValueAsString().should.eql("Blue");
            sc1.should.not.eql(StatusCodes.Good);
            sc1.should.eql(StatusCodes.BadOutOfRange);
            //xx console.log(sc1.toString());
        });

        describe("edge case tests", () => {
            let multiStateValueDiscreteVariable: UAMultiStateValueDiscreteEx<number, DataType.UInt32>;
            before(() => {
                const objectsFolder = addressSpace.rootFolder.objects;
                multiStateValueDiscreteVariable = namespace.addMultiStateValueDiscrete<number, DataType.UInt32>({
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
                const dataValue = new DataValueT<number, DataType.UInt32>({
                    value: { dataType: DataType.UInt32, value: 100 } // out of range
                });
                const statusCode = await multiStateValueDiscreteVariable.writeValue(context, dataValue);
                statusCode.should.eql(StatusCodes.BadOutOfRange);
            });

            it("writing a value within EnumValues shall return Good", async () => {
                const dataValue = new DataValueT<number, DataType.UInt32>({
                    value: { dataType: DataType.UInt32, value: 0x0000ff } // OK
                });

                const statusCode = await multiStateValueDiscreteVariable.writeValue(context, dataValue);

                statusCode.should.eql(StatusCodes.Good);

                // Xx console.log(  multiStateValue.readValue().toString());
                // Xx console.log(  multiStateValue.valueAsText.readValue().toString());

                multiStateValueDiscreteVariable.valueAsText.readValue().value.value.text!.should.eql("Blue");
            });

            it("changing MultiStateVariable value shall change valueAsText accordingly", async () => {
                const dataValue0 = new DataValueT<number, DataType.UInt32>({
                    value: { dataType: DataType.UInt32, value: 0x0000ff } // OK
                });

                const statusCode0 = await multiStateValueDiscreteVariable.writeValue(context, dataValue0);

                const dataValue = new DataValue({
                    value: {
                        dataType: DataType.UInt32,
                        value: 0x00ff00
                    } // OK
                }) as DataValueT<number, DataType.UInt32>;
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
            color: UAMultiStateValueDiscreteEx<any, any>;
            // instantiate(options: InstantiateObjectOptions): MyObjectWithMultiStateValueDiscrete;
        }

        interface MyObjectWithMultiStateValueDiscrete extends UAObject {
            color: UAMultiStateValueDiscreteEx<any, any>;
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

            // console.log("obj.color.enumValues.readValue().value.value ", obj.color.enumValues.readValue().value.value);

            const arr = obj.color.enumValues.readValue().value.value as unknown as EnumValueType[];
            arr[0].displayName.text!.should.eql("Red");
            arr[1].displayName.text!.should.eql("Orange");
            arr[2].displayName.text!.should.eql("Green");
            arr[3].displayName.text!.should.eql("Blue");

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

        it("should handle value=0 appropriately (fixes issue #1323", () => {
            // create a new DataType
            const myObjectType = namespace.addObjectType({
                browseName: "MyObjectWithMultiStateValueDiscrete1323Type"
            }) as MyObjectWithMultiStateValueDiscreteType;

            namespace.addMultiStateValueDiscrete({
                browseName: "MultiStateValueDiscrete1323",
                componentOf: myObjectType,
                dataType: DataType.Int64,
                enumValues: { Zero: 0, One: 1, Twenty: 20 },
                modellingRule: "Mandatory",
                value: 0
            });
            // instantiate  the type
            const obj = myObjectType.instantiate({
                browseName: "MyObject"
            }) as MyObjectWithMultiStateValueDiscrete;

            const multiStateValueDiscrete1323 = obj.getChildByName("MultiStateValueDiscrete1323") as UAMultiStateValueDiscreteEx<
                any,
                any
            >;
            // verification
            multiStateValueDiscrete1323.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
            multiStateValueDiscrete1323.valueAsText.readValue().value.value.text!.should.eql("Zero");
            multiStateValueDiscrete1323.readValue().value.value.should.eql(coerceInt64(0));

            multiStateValueDiscrete1323.setValue("One");
            multiStateValueDiscrete1323.readValue().value.value.should.eql(coerceInt64(1));
            multiStateValueDiscrete1323.getValueAsString().should.eql("One");

            multiStateValueDiscrete1323.setValue("Zero");
            multiStateValueDiscrete1323.readValue().value.value.should.eql(coerceInt64(0));
            multiStateValueDiscrete1323.getValueAsString().should.eql("Zero");

            multiStateValueDiscrete1323.setValue("Twenty");
            multiStateValueDiscrete1323.readValue().value.value.should.eql(coerceInt64(20));
            multiStateValueDiscrete1323.getValueAsString().should.eql("Twenty");

            multiStateValueDiscrete1323.setValueFromSource({
                dataType: DataType.Int64,
                arrayType: VariantArrayType.Scalar,
                value: coerceInt64(1)
            });
            multiStateValueDiscrete1323.readValue().value.value.should.eql(coerceInt64(1));
            multiStateValueDiscrete1323.getValueAsString().should.eql("One");

            multiStateValueDiscrete1323.setValueFromSource({
                dataType: DataType.Int64,
                arrayType: VariantArrayType.Scalar,
                value: coerceInt64(0)
            });
            multiStateValueDiscrete1323.setValue("Zero");
            multiStateValueDiscrete1323.readValue().value.value.should.eql(coerceInt64(0));
            multiStateValueDiscrete1323.getValueAsString().should.eql("Zero");

            multiStateValueDiscrete1323.setValueFromSource({
                dataType: DataType.Int64,
                arrayType: VariantArrayType.Scalar,
                value: coerceInt64(20)
            });
            multiStateValueDiscrete1323.setValue("Twenty");
            multiStateValueDiscrete1323.readValue().value.value.should.eql(coerceInt64(20));
            multiStateValueDiscrete1323.getValueAsString().should.eql("Twenty");
        });

        const toEnumName = (value: number) => {
            const v = coerceInt32(value);
            return `T${v < 0 ? "M" : ""}${Math.abs(v).toString()}`;
        };

        [
            {
                dataType: DataType.Int64,
                coerce: coerceInt64,
                values: [-10, 0, 20]
            },
            {
                dataType: DataType.Int32,
                coerce: coerceInt32,
                values: [-10, 0, 20]
            },
            {
                dataType: DataType.SByte,
                coerce: coerceInt8,
                values: [-10, 0, 20]
            },
            // unsigned
            {
                dataType: DataType.UInt64,
                coerce: coerceUInt64,
                values: [10, 0, 20]
            },
            {
                dataType: DataType.UInt32,
                coerce: coerceUInt32,
                values: [10, 0, 20]
            },
            {
                dataType: DataType.Byte,
                coerce: coerceUInt8,
                values: [10, 0, 20]
            }
        ].forEach(({ dataType, coerce, values }) => {
            it("should handle all sort of scalar MultiDiscreteValue " + DataType[dataType], () => {
                const suffix = DataType[dataType];

                const myObjectType = namespace.addObjectType({
                    browseName: "Obj" + suffix + "Type"
                });

                const enumValues: EnumValueTypeOptionsLike[] = values.map((value) => ({
                    displayName: toEnumName(value),
                    value: coerceInt64(value)
                }));

                namespace.addMultiStateValueDiscrete({
                    browseName: "MultiStateValueDiscrete" + suffix,
                    componentOf: myObjectType,
                    dataType,
                    enumValues,
                    modellingRule: "Mandatory",
                    value: values[0]
                });

                // instantiate  the type
                const obj = myObjectType.instantiate({
                    browseName: "MyObject1" + suffix
                });

                const multiStateValueDiscrete1323 = obj.getChildByName(
                    "MultiStateValueDiscrete" + suffix
                ) as UAMultiStateValueDiscreteEx<any, any>;

                const initialValue = values[0];
                const initialEnumName = toEnumName(initialValue);
                // verification
                multiStateValueDiscrete1323.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
                multiStateValueDiscrete1323.valueAsText.readValue().value.value.text!.should.eql(initialEnumName);
                multiStateValueDiscrete1323.readValue().value.value.should.eql(coerce(initialValue));

                for (let index = 0; index < values.length; index++) {
                    const curValue = values[index];
                    const curEnumName = toEnumName(curValue);

                    multiStateValueDiscrete1323.setValue(curEnumName);
                    multiStateValueDiscrete1323.readValue().value.value.should.eql(coerce(curValue));
                    multiStateValueDiscrete1323.getValueAsString().should.eql(curEnumName);
                }
                for (let index = 0; index < values.length; index++) {
                    const curValue = values[index];
                    const curEnumName = toEnumName(curValue);

                    multiStateValueDiscrete1323.setValueFromSource({
                        dataType,
                        arrayType: VariantArrayType.Scalar,
                        value: coerce(curValue)
                    });
                    multiStateValueDiscrete1323.readValue().value.value.should.eql(coerce(curValue));
                    multiStateValueDiscrete1323.getValueAsString().should.eql(curEnumName);
                }
                for (let index = 0; index < values.length; index++) {
                    const curValue = values[index];
                    const curEnumName = toEnumName(curValue);

                    multiStateValueDiscrete1323.setValue(curValue);
                    multiStateValueDiscrete1323.readValue().value.value.should.eql(coerce(curValue));
                    multiStateValueDiscrete1323.getValueAsString().should.eql(curEnumName);
                }
            });
        });

        function convertToArray<T>(array: any): T[] {
            if (Array.isArray(array)) return array;
            const result: T[] = [];
            for (let i = 0; i < array.length; i++) {
                result[i] = array[i];
            }
            return result;
        }
        [
            {
                dataType: DataType.Int32,
                coerce: coerceInt32,
                values: [0, -10, 20]
            },
            {
                dataType: DataType.UInt32,
                coerce: coerceUInt32,
                values: [0, 10, 20]
            },
            {
                dataType: DataType.Int64,
                coerce: coerceInt64,
                values: [0, -10, 20]
            },
            {
                dataType: DataType.UInt64,
                coerce: coerceUInt64,
                values: [0, 10, 20]
            }
        ].forEach(({ dataType, coerce, values }) => {
            it("should handle all sort of Array MultiDiscreteValue " + DataType[dataType] + "[]", () => {
                const suffix = DataType[dataType];

                const myObjectType = namespace.addObjectType({
                    browseName: "ObjA" + suffix + "Type"
                });

                const enumValues: EnumValueTypeOptionsLike[] = values.map((value) => ({
                    displayName: toEnumName(value),
                    value: coerceInt64(value)
                }));

                const value = new Variant({
                    arrayType: VariantArrayType.Array,
                    dataType,
                    value: [values[0], values[1]]
                });
                const msvd = namespace.addMultiStateValueDiscrete({
                    browseName: "MultiStateValueDiscrete" + suffix,
                    componentOf: myObjectType,
                    dataType,
                    enumValues,
                    valueRank: 1,
                    modellingRule: "Mandatory",
                    value
                });

                // instantiate  the type
                const obj = myObjectType.instantiate({
                    browseName: "MyObjectA" + suffix
                });

                const multiStateValueDiscrete1323 = obj.getChildByName(
                    "MultiStateValueDiscrete" + suffix
                ) as UAMultiStateValueDiscreteArrayEx<any, any>;

                // verification
                multiStateValueDiscrete1323.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);

                const tt = multiStateValueDiscrete1323.readValue().value.value;
                tt.length.should.eql(2);
                tt[0].should.eql(coerce(values[0]));
                tt[1].should.eql(coerce(values[1]));

                const a = multiStateValueDiscrete1323.valueAsText.readValue().value.value;
                a.length.should.eql(2);
                // xx console.log(a);
                a.map(({ text }) => text).should.eql([toEnumName(values[0]), toEnumName(values[1])]);

                const t = multiStateValueDiscrete1323.getValueAsString();
                t.length.should.eql(2);
                t.should.eql([toEnumName(values[0]), toEnumName(values[1])]);

                const n = multiStateValueDiscrete1323.getValueAsNumber();
                n.length.should.eql(2);
                convertToArray(n).should.eql([coerce(values[0]), coerce(values[1])]);
            });
        });
    });
}
