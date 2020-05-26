import * as should from "should";
import { AddressSpace, Namespace, SessionContext } from "../..";

export function subtest_two_state_discrete_type(maintest: any) {

    describe("TwoStateDiscreteType", () => {

        let addressSpace: AddressSpace;
        before(() => {
            addressSpace = maintest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);
        });

        it("should add a TwoStateDiscreteType variable", () => {

            const namespace = addressSpace.getOwnNamespace();

            const objectsFolder = addressSpace.rootFolder.objects;

            const prop = namespace.addTwoStateDiscrete({
                browseName: "MySwitch",
                falseState: "idle",
                organizedBy: objectsFolder,
                trueState: "busy",
                value: false
            });
            prop.browseName.toString().should.eql("1:MySwitch");

            prop.getPropertyByName("TrueState")!.readValue().value.toString()
                .should.eql("Variant(Scalar<LocalizedText>, value: locale=null text=busy)");

            prop.getPropertyByName("FalseState")!.readValue().value.toString()
                .should.eql("Variant(Scalar<LocalizedText>, value: locale=null text=idle)");

            prop.readValue().value.toString().should.eql("Variant(Scalar<Boolean>, value: false)");
        });

    });
}
