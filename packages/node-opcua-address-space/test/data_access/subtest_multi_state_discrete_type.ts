import * as should from "should";

import { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { Variant } from "node-opcua-variant";
import { DataType } from "node-opcua-variant";
import { AddressSpace, Namespace, SessionContext , UAMultiStateDiscrete } from "../..";

export function subtest_multi_state_discrete_type(maintest: any) {

    describe("MultiStateDiscreteType", () => {

        let addressSpace: AddressSpace;
        before(() => {
            addressSpace = maintest.addressSpace;
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

            const prop = namespace.addMultiStateDiscrete({
                browseName: "MyMultiStateVariable",
                enumStrings: ["Red", "Orange", "Green"],
                organizedBy: objectsFolder,
                value: 1 // Orange
            });
            prop.browseName.toString().should.eql("1:MyMultiStateVariable");

            prop.valueRank.should.eql(-2);

            prop.getPropertyByName("EnumStrings")!.readValue().value.toString()
              .should.eql(
              "Variant(Array<LocalizedText>, l= 3, value=[locale=null text=Red,locale=null text=Orange,locale=null text=Green])");

            prop.enumStrings.readValue().value.dataType.should.eql(DataType.LocalizedText);

            prop.readValue().value.toString().should.eql("Variant(Scalar<UInt32>, value: 1)");
            prop.readValue().value.dataType.should.eql(DataType.UInt32);
        });

        describe("edge case tests", () => {

            let multiState: UAMultiStateDiscrete;
            before(() => {
                const namespace = addressSpace.getOwnNamespace();

                const objectsFolder = addressSpace.rootFolder.objects;

                multiState = namespace.addMultiStateDiscrete({
                    browseName: "MyMultiStateVariable",
                    enumStrings: ["Red", "Orange", "Green"],
                    organizedBy: objectsFolder,
                    value: 1 // Orange
                });

            });

            it("writing a value exceeding EnumString length shall return BadOutOfRange", async () => {
                const dataValue = new DataValue({
                    value: new Variant({ dataType: DataType.UInt32, value: 100 })// out of range
                });
                const statusCode = await multiState.writeValue(SessionContext.defaultContext, dataValue, null);
                statusCode.should.eql(StatusCodes.BadOutOfRange);
            });

            it("writing a value within EnumString length shall return Good", async () => {
                const dataValue = new DataValue({
                    value: new Variant({ dataType: DataType.UInt32, value: 2 })// OK
                });
                const statusCode = await  multiState.writeValue(SessionContext.defaultContext, dataValue, null);
                statusCode.should.eql(StatusCodes.Good);
            });
        });
    });
}
