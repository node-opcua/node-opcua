import * as should from "should";

import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { AddressSpace, SessionContext, UAMultiStateDiscrete } from "../..";

export function subtest_multi_state_discrete_type(mainTest: { addressSpace: AddressSpace }) {
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

            const multiStateDiscreteVariable = namespace.addMultiStateDiscrete({
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

        describe("edge case tests", () => {
            let multiStateDiscreteVariable: UAMultiStateDiscrete;
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
                const dataValue = new DataValue({
                    value: new Variant({ dataType: DataType.UInt32, value: 100 }) // out of range
                });
                const statusCode = await multiStateDiscreteVariable.writeValue(SessionContext.defaultContext, dataValue);
                statusCode.should.eql(StatusCodes.BadOutOfRange);
            });

            it("writing a value within EnumString length shall return Good", async () => {
                const dataValue = new DataValue({
                    value: new Variant({ dataType: DataType.UInt32, value: 2 }) // OK
                });
                const statusCode = await multiStateDiscreteVariable.writeValue(SessionContext.defaultContext, dataValue);
                statusCode.should.eql(StatusCodes.Good);
            });
            it("writing a value which has not the correct type shall return BadTypeMismatch", async () => {
                const dataValue = new DataValue({
                    value: new Variant({
                        dataType: DataType.String,
                        value: "2"
                    }) // OK
                });
                const statusCode = await multiStateDiscreteVariable.writeValue(SessionContext.defaultContext, dataValue);
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
