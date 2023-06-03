"use strict";
import "should";
import { DataType } from "node-opcua-variant";
import { AddressSpace, UAObject } from "../..";

export function utest_issue_316(test: any): void {
    describe("Alarm&Condition ConditionClassName and ConditionName ", () => {
        let addressSpace: AddressSpace;
        let source: UAObject;
        before(() => {
            addressSpace = test.addressSpace;
            source = test.source;
        });
        it("CC1 - should be possible to set the ConditionName and ConditionClassName of an alarm", () => {
            const condition = addressSpace.getOwnNamespace().instantiateCondition("AlarmConditionType", {
                browseName: "AlarmCondition1",
                componentOf: source,
                conditionSource: source,

                conditionClass: "ProcessConditionClassType",
                conditionName: "MyConditionName"
            });
            condition.browseName.toString().should.eql("1:AlarmCondition1");

            // ConditionClassId : NodeId
            // ConditionClassName: LocalizedText
            // ConditionName:      String

            // The ConditionType inherits all Properties of the BaseEventType. Their semantic is defined in
            // Part 5. SourceNode identifies the ConditionSource. See 5.12 for more details. If the
            // ConditionSource is not a Node in the AddressSpace the NodeId is set to null. The
            // SourceNode is the Node which the condition is associated with, it may be the same as the
            // InputNode for an alarm, but it may be a separate node. For example a motor, which is a
            // variable with a value that is an RPM, may be the ConditionSource for Conditions that are
            // related to the motor as well as a temperature sensor associated with the motor. In the former
            // the InputNode for the High RPM alarm is the value of the Motor RPM, while in the later the
            // InputNode of the High Alarm would be the value of the temperature sensor that is associated
            // with the motor.
            // ConditionClassId specifies in which domain this Condition is used. It is the NodeId of the
            // corresponding ConditionClassType. See 5.9 for the definition of ConditionClass and a set of
            // ConditionClasses defined in this standard. When using this Property for filtering, Clients have
            // to specify all individual ConditionClassType NodeIds. The OfType operator cannot be applied.
            // BaseConditionClassType is used as class whenever a Condition cannot be assigned to a
            // more concrete class.
            const processConditionClassType = addressSpace.findObjectType("ProcessConditionClassType")!;
            condition.conditionClassId.readValue().value.dataType.should.equal(DataType.NodeId);
            condition.conditionClassId.readValue().value.value.toString().should.equal(processConditionClassType.nodeId.toString());

            // ConditionClassName provides the display name of the ConditionClassType.
            condition.conditionClassName.readValue().value.dataType.should.equal(DataType.LocalizedText);
            condition.conditionClassName
                .readValue()
                .value.value.text!.toString()
                .should.equal(processConditionClassType.displayName[0].text);

            // ConditionName identifies the Condition instance that the Event originated from. It can be used
            // together with the SourceName in a user display to distinguish between different Condition
            // instances. If a ConditionSource has only one instance of a ConditionType, and the Server has
            // no instance name, the Server shall supply the ConditionType browse name.
            condition.conditionName.readValue().value.dataType.should.eql(DataType.String);
            condition.conditionName.readValue().value.value!.should.eql("MyConditionName");
        });
    });
}
