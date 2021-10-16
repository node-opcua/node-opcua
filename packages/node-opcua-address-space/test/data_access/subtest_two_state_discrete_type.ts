import * as fs from "fs";

import * as should from "should";
import sinon = require("sinon");

import { AccessLevelFlag, coerceLocalizedText } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import { getTempFilename } from "node-opcua-debug/nodeJS";
import { CallbackT, StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataValue, DataValueT } from "node-opcua-data-value";
import { getCurrentClock } from "node-opcua-date-time";
import { DataType } from "node-opcua-variant";

import { AddressSpace, UAObject, UAObjectType, SessionContext, UATwoStateDiscreteEx } from "../..";
import { generateAddressSpace } from "../../distNodeJS";

const doDebug = false;

export function subtest_two_state_discrete_type(mainTest: { addressSpace: AddressSpace }): void {
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
            myState: UATwoStateDiscreteEx;
        }
        interface MyObjectWithTwoStateDiscrete extends UAObject {
            myState: UATwoStateDiscreteEx;
        }
        it("ZZ2 should instantiate a DataType containing a TwoStateDiscreteType", async () => {
            const namespace = addressSpace.getOwnNamespace();
            const myObjectType = namespace.addObjectType({
                browseName: "MyObjectWithTwoStateDiscreteType"
            }) as MyObjectWithTwoStateDiscreteType;

            const v = namespace.addTwoStateDiscrete({
                browseName: "MyState",
                componentOf: myObjectType,
                falseState: "SomeFalseState",
                trueState: "SomeTrueState",
                value: true,

                modellingRule: "Mandatory"
            });
            should.exist(myObjectType.getComponentByName("MyState"));

            v.getValue().should.eql(true);
            v.readValue().statusCode.should.eql(StatusCodes.Good);

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

        it("ZZ3 should create a TwoStateVariable with value getter/setter", async () => {
            const namespace = addressSpace.getOwnNamespace();
            const myObject = namespace.addObject({
                browseName: "MyObjectWithTwoStateDiscrete"
            }) as MyObjectWithTwoStateDiscrete;

            let _theValue = true;

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
                        value: { dataType: DataType.Boolean, value: _theValue }
                    });
                    callback(null, myDataValue);
                }, 10); //simulate some delay
            };
            const timestamped_set_raw = (dataValue: DataValue, callback: CallbackT<StatusCode>) => {
                if (dataValue.value.dataType !== DataType.Boolean) {
                    return callback(new Error("Invalid DataType"));
                }
                setTimeout(() => {
                    _theValue = dataValue.value.value;
                    callback(null, StatusCodes.Good);
                }, 10);
            };
            const timestamped_set = sinon.spy(timestamped_set_raw);
            const timestamped_get = sinon.spy(timestamped_get_raw);

            const v = namespace.addTwoStateDiscrete({
                browseName: "MyState",
                componentOf: myObject,
                falseState: "SomeFalseState",
                trueState: "SomeTrueState",

                value: {
                    timestamped_get: timestamped_get as any,
                    timestamped_set: timestamped_set as any
                }
            });
            should.exist(myObject.getComponentByName("MyState"));

            // because we use getter and setter, we need to call at least readValueAsync once
            // to get the initial value....
            const dv0 = await myObject.myState.readValueAsync(SessionContext.defaultContext);

            v.getValue().should.eql(true);
            v.readValue().statusCode.should.eql(StatusCodes.Good);
            // ----------------

            _theValue = false;
            const dv1 = await myObject.myState.readValueAsync(SessionContext.defaultContext);
            myObject.myState.getValueAsString().should.eql("SomeFalseState");
            //
            _theValue = true;
            await myObject.myState.readValueAsync(SessionContext.defaultContext);
            myObject.myState.getValueAsString().should.eql("SomeTrueState");
            //

            // external write
            const clock = getCurrentClock();
            await myObject.myState.writeValue(
                SessionContext.defaultContext,
                new DataValue({
                    serverPicoseconds: clock.picoseconds,
                    serverTimestamp: clock.timestamp,
                    sourcePicoseconds: clock.picoseconds,
                    sourceTimestamp: clock.timestamp,
                    statusCode: StatusCodes.Good,
                    value: { dataType: DataType.Boolean, value: false }
                }) as DataValueT<boolean, DataType.Boolean>
            );

            myObject.myState.getValueAsString().should.eql("SomeFalseState");
            timestamped_set.callCount.should.eql(1);
            timestamped_get.callCount.should.eql(3);
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

            if (doDebug) {
                console.log(xmlString);
            }
            fs.writeFileSync(xmlFile, xmlString);

            addressSpace.dispose();
        }

        it("ZZ4 should promote automatically TwoStateDiscrete Variable found while loading nodeset2.xml", async () => {
            const xmlFile = getTempFilename("nodeSetWithTwoDiscreteInType.xml");
            await generateXml(xmlFile);
            const addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, [nodesets.standard, xmlFile]);

            const namespace = addressSpace.registerNamespace("uri:myOwnNamespace");

            const ns = addressSpace.getNamespaceIndex("uri:mynamespace");
            const myObjectWithTwoStateDiscreteType = addressSpace.findObjectType("MyObjectWithTwoStateDiscreteType", ns);

            const o = myObjectWithTwoStateDiscreteType?.instantiate({ browseName: "MyObject" }) as MyObjectWithTwoStateDiscrete;
            o.myState.constructor.name.should.eql("UATwoStateDiscreteImpl");

            addressSpace.dispose();
        });
    });
}
