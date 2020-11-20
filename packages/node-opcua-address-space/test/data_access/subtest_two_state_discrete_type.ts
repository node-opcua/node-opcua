import * as should from "should";
import * as fs from "fs";
import * as path from "path";
import sinon = require("sinon");

import { AccessLevelFlag, coerceLocalizedText } from "node-opcua-data-model";
import { DataType } from "node-opcua-variant";

import { AddressSpace, Namespace, UAObject, UAObjectType } from "../..";
import { UATwoStateDiscrete } from "../../dist/src/data_access/ua_two_state_discrete";
import { generateAddressSpace } from "../../../playground/node_modules/node-opcua/dist";
import { nodesets } from "node-opcua-nodesets";
import { getTempFilename } from "node-opcua-debug/nodeJS";

export function subtest_two_state_discrete_type(mainTest: { addressSpace: AddressSpace }) {
    describe("TwoStateDiscreteType", () => {
        let addressSpace: AddressSpace;
        before(() => {
            addressSpace = mainTest.addressSpace;
            should(addressSpace).be.instanceof(AddressSpace);
        });
        it("TwoStateDiscrete should not be abstract", () => {
            const twoStateDiscreteType = addressSpace.findVariableType("TwoStateDiscreteType")!;
            twoStateDiscreteType.isAbstract.should.eql(false);
        });

        it("should add a TwoStateDiscreteType variable", () => {
            const namespace = addressSpace.getOwnNamespace();
            const objectsFolder = addressSpace.rootFolder.objects;

            const twoStateDiscreteVariable = namespace.addTwoStateDiscrete({
                organizedBy: objectsFolder,

                browseName: "MySwitch",
                falseState: "idle",
                trueState: "busy",
                value: false
            });
            twoStateDiscreteVariable.browseName.toString().should.eql("1:MySwitch");

            twoStateDiscreteVariable
                .getPropertyByName("TrueState")!
                .readValue()
                .value.toString()
                .should.eql("Variant(Scalar<LocalizedText>, value: locale=null text=busy)");

            twoStateDiscreteVariable
                .getPropertyByName("FalseState")!
                .readValue()
                .value.toString()
                .should.eql("Variant(Scalar<LocalizedText>, value: locale=null text=idle)");

            twoStateDiscreteVariable.readValue().value.toString().should.eql("Variant(Scalar<Boolean>, value: false)");
        });

        it("UATwoStateDiscrete#setValue", () => {
            const namespace = addressSpace.getOwnNamespace();
            const objectsFolder = addressSpace.rootFolder.objects;

            const twoStateDiscreteVariable = namespace.addTwoStateDiscrete({
                organizedBy: objectsFolder,

                browseName: "MySwitch2",
                falseState: "SomeFalseState",
                trueState: "SomeTrueState",
                value: false
            });
            twoStateDiscreteVariable.getValue().should.eql(false);
            twoStateDiscreteVariable.getValueAsString().should.eql("SomeFalseState");
            twoStateDiscreteVariable.setValue(true);
            twoStateDiscreteVariable.getValue().should.eql(true);
            twoStateDiscreteVariable.getValueAsString().should.eql("SomeTrueState");
            twoStateDiscreteVariable.setValue("SomeFalseState");
            twoStateDiscreteVariable.getValue().should.eql(false);
            twoStateDiscreteVariable.getValueAsString().should.eql("SomeFalseState");
            twoStateDiscreteVariable.setValue("SomeTrueState");
            twoStateDiscreteVariable.getValue().should.eql(true);
            twoStateDiscreteVariable.getValueAsString().should.eql("SomeTrueState");

            should.throws(() => twoStateDiscreteVariable.setValue("BADSomeTrueState"));

            twoStateDiscreteVariable.getValue().should.eql(true);
            twoStateDiscreteVariable.getValueAsString().should.eql("SomeTrueState");
        });

        interface MyObjectWithTwoStateDiscreteType extends UAObjectType {
            myState: UATwoStateDiscrete;
        }
        interface MyObjectWithTwoStateDiscrete extends UAObject {
            myState: UATwoStateDiscrete;
        }
        it("ZZ2 should instantiate a DataType containing a TwoStateDiscreteType", async () => {
            const namespace = addressSpace.getOwnNamespace();
            // create a new DataType
            const myObjectType = namespace.addObjectType({
                browseName: "MyObjectWithTwoStateDiscreteType"
            }) as MyObjectWithTwoStateDiscreteType;

            namespace.addTwoStateDiscrete({
                browseName: "MyState",
                componentOf: myObjectType,
                falseState: "SomeFalseState",
                trueState: "SomeTrueState",
                value: true,

                modellingRule: "Mandatory"
            });
            should.exist(myObjectType.getComponentByName("MyState"));

            myObjectType.myState.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
            // add

            // instantiate  the type
            const obj = myObjectType.instantiate({
                browseName: "MyObject"
            }) as MyObjectWithTwoStateDiscrete;
            should.exist(obj.getComponentByName("MyState"));

            // verification
            obj.myState.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
            obj.myState.readValue().value.value.should.eql(true);
            obj.myState.trueState.readValue().value.value.text!.should.eql("SomeTrueState");

            // it
            obj.myState.setValue(true);
            obj.myState.getValueAsString().should.eql("SomeTrueState");

            obj.myState.setValue(false);
            obj.myState.getValueAsString().should.eql("SomeFalseState");

            const spy = sinon.spy();
            obj.myState.on("semantic_changed", spy);

            obj.myState.trueState.setValueFromSource({
                dataType: DataType.LocalizedText,
                value: coerceLocalizedText("NewTrueState")
            });
            spy.callCount.should.eql(1);
        });

        async function generateXml(xmlFile: string): Promise<void> {
            const addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, [nodesets.standard]);

            const namespace = addressSpace.registerNamespace("uri:mynamespace");
            const myObjectType = namespace.addObjectType({
                browseName: "MyObjectWithTwoStateDiscreteType"
            }) as MyObjectWithTwoStateDiscreteType;

            namespace.addTwoStateDiscrete({
                browseName: "MyState",
                componentOf: myObjectType,
                falseState: "SomeFalseState",
                trueState: "SomeTrueState",
                value: true,

                modellingRule: "Mandatory"
            });

            const xmlString = namespace.toNodeset2XML();

            console.log(xmlString);
            fs.writeFileSync(xmlFile, xmlString);

            addressSpace.dispose();
        }

        it("ZZ2 should promote automatically TwoStateDiscrete Variable found while loading nodeset2.xml", async () => {
            const xmlFile = getTempFilename("nodeSetWithTwoDiscreteInType.xml");
            await generateXml(xmlFile);
            const addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, [nodesets.standard, xmlFile]);

            const namespace = addressSpace.registerNamespace("uri:myOwnNamespace");

            const ns = addressSpace.getNamespaceIndex("uri:mynamespace");
            const myObjectWithTwoStateDiscreteType = addressSpace.findObjectType("MyObjectWithTwoStateDiscreteType", ns);

            const o = myObjectWithTwoStateDiscreteType?.instantiate({ browseName: "MyObject" }) as MyObjectWithTwoStateDiscrete;
            o.myState.constructor.name.should.eql("UATwoStateDiscrete");

            addressSpace.dispose();
        });
    });
}
