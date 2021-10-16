import * as should from "should";

import { DataValue, DataValueOptionsT, DataValueT } from "node-opcua-data-value";
import { CallbackT, StatusCode, StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { getCurrentClock } from "node-opcua-date-time";
import * as sinon from "sinon";

import { AddressSpace, SessionContext, UAMultiStateDiscrete, UAMultiStateDiscreteEx } from "../..";

export function subtest_multi_state_discrete_type(mainTest: { addressSpace: AddressSpace }): void {
    describe("MultiStateDiscreteType", () => {
        let addressSpace: AddressSpace;
        before(() => {
            addressSpace = mainTest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);
        });

        it("MultiStateDiscreteType should not be abstract", () => {
            const multiStateDiscreteType = addressSpace.findVariableType("MultiStateDiscreteType")!;
            multiStateDiscreteType.isAbstract.should.eql(false);
        });

        it("should add a MultiStateDiscreteType variable", () => {
            const namespace = addressSpace.getOwnNamespace();

            const objectsFolder = addressSpace.findNode("ObjectsFolder")!;
            objectsFolder.browseName.toString().should.eql("Objects");

            const multiStateDiscreteVariable = namespace.addMultiStateDiscrete<number, DataType.UInt32>({
                browseName: "MyMultiStateVariable",
                enumStrings: ["Red", "Orange", "Green"],
                organizedBy: objectsFolder,
                value: 1 // Orange
            });
            multiStateDiscreteVariable.browseName.toString().should.eql("1:MyMultiStateVariable");

            multiStateDiscreteVariable.valueRank.should.eql(-2);

            multiStateDiscreteVariable
                .getPropertyByName("EnumStrings")!
                .readValue()
                .value.toString()
                .should.eql(
                    "Variant(Array<LocalizedText>, l= 3, value=[locale=null text=Red,locale=null text=Orange,locale=null text=Green])"
                );

            multiStateDiscreteVariable.enumStrings.readValue().value.dataType.should.eql(DataType.LocalizedText);

            multiStateDiscreteVariable.readValue().value.toString().should.eql("Variant(Scalar<UInt32>, value: 1)");
            multiStateDiscreteVariable.readValue().value.dataType.should.eql(DataType.UInt32);
        });

        it("ZZ3 should create a MultiStateDiscreteType with value getter/setter", async () => {
            const namespace = addressSpace.getOwnNamespace();

            let _theValue = 0; // Red

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

            const multiStateDiscreteVariable = namespace.addMultiStateDiscrete({
                browseName: "MultiStateDiscreteVariableWithGetterAndSetter",
                organizedBy: addressSpace.rootFolder.objects,
                enumStrings: ["Red", "Orange", "Green"],

                value: {
                    timestamped_get,
                    timestamped_set
                }
            });

            // because we use getter and setter, we need to call at least readValueAsync once
            // to get the initial value....
            const dv0 = await multiStateDiscreteVariable.readValueAsync(SessionContext.defaultContext);

            multiStateDiscreteVariable.getValue().should.eql(0);
            multiStateDiscreteVariable.readValue().statusCode.should.eql(StatusCodes.Good);
            multiStateDiscreteVariable.getValueAsString().should.eql("Red");
            // ----------------

            _theValue = 2;
            const dv1 = await multiStateDiscreteVariable.readValueAsync(SessionContext.defaultContext);
            multiStateDiscreteVariable.getValueAsString().should.eql("Green");
            //
            _theValue = 1;
            await multiStateDiscreteVariable.readValueAsync(SessionContext.defaultContext);
            multiStateDiscreteVariable.getValueAsString().should.eql("Orange");
            //

            // external write
            const clock = getCurrentClock();
            await multiStateDiscreteVariable.writeValue(
                SessionContext.defaultContext,
                new DataValue({
                    serverPicoseconds: clock.picoseconds,
                    serverTimestamp: clock.timestamp,
                    sourcePicoseconds: clock.picoseconds,
                    sourceTimestamp: clock.timestamp,
                    statusCode: StatusCodes.Good,
                    value: { dataType: DataType.UInt32, value: 2 }
                })
            );

            multiStateDiscreteVariable.getValueAsString().should.eql("Green");
            timestamped_set.callCount.should.eql(1);
            timestamped_get.callCount.should.eql(3);

            /// now trying with invalid values to see how
            const sc1 = await multiStateDiscreteVariable.writeValue(
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
            multiStateDiscreteVariable.getValueAsString().should.eql("Green");
            sc1.should.not.eql(StatusCodes.Good);
            sc1.should.eql(StatusCodes.BadOutOfRange);
        });

        describe("edge case tests", () => {
            let multiStateDiscreteVariable: UAMultiStateDiscreteEx<number, DataType.UInt32>;
            before(() => {
                const namespace = addressSpace.getOwnNamespace();

                const objectsFolder = addressSpace.rootFolder.objects;

                multiStateDiscreteVariable = namespace.addMultiStateDiscrete({
                    browseName: "MyMultiStateVariable3",
                    enumStrings: ["Red", "Orange", "Green"],
                    organizedBy: objectsFolder,
                    value: 1 // Orange
                });
            });

            it("writing a value exceeding EnumString length shall return BadOutOfRange", async () => {
                const dataValue = new DataValueT<number, DataType.UInt32>({
                    value: new Variant({ dataType: DataType.UInt32, value: 100 }) // out of range
                });
                const statusCode = await multiStateDiscreteVariable.writeValue(SessionContext.defaultContext, dataValue);
                statusCode.should.eql(StatusCodes.BadOutOfRange);
            });

            it("writing a value within EnumString length shall return Good", async () => {
                const dataValue = new DataValueT<number, DataType.UInt32>({
                    value: { dataType: DataType.UInt32, value: 2 } // OK
                });
                const statusCode = await multiStateDiscreteVariable.writeValue(SessionContext.defaultContext, dataValue);
                statusCode.should.eql(StatusCodes.Good);
            });
            it("writing a value which has not the correct type shall return BadTypeMismatch", async () => {
                const dataValue = new DataValueT<string, DataType.String>({
                    value: {
                        dataType: DataType.String,
                        value: "2"
                    } // OK
                });
                const statusCode = await multiStateDiscreteVariable.writeValue(
                    SessionContext.defaultContext,
                    dataValue as any /* to force wrong value to be sent */
                );
                statusCode.should.eql(StatusCodes.BadTypeMismatch);
            });

            it("using setValue", () => {
                multiStateDiscreteVariable.setValue("Green");
                multiStateDiscreteVariable.getValue().should.eql(2);
                multiStateDiscreteVariable.getValueAsString().should.eql("Green");
                multiStateDiscreteVariable.setValue("Red");
                multiStateDiscreteVariable.getValue().should.eql(0);
                multiStateDiscreteVariable.getValueAsString().should.eql("Red");
            });
        });
    });
}
