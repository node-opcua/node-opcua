/**
 * Giving an alarm a message of its own, using only what the package publishes.
 *
 * This is the example from calculateConditionInfo's own documentation. It did not run as
 * written: `ConditionInfo` was exported as a type with no constructor, and the override point
 * was `_calculateConditionInfo` on an unpublished class - so following the documentation meant
 * importing two names from inside the package.
 *
 * The imports below are the point of the test. If either name has to come from a deep path
 * again, this stops compiling.
 */
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import should from "should";

import {
    AddressSpace,
    ConditionInfo,
    type Namespace,
    type UAExclusiveLimitAlarmEx,
    type UAObject,
    type UAVariable
} from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

describe("custom condition info on an alarm", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 30000));

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let source: UAObject;
    let inputNode: UAVariable;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        namespace = addressSpace.registerNamespace("Private");
        addressSpace.installAlarmsAndConditionsService();

        const green = namespace.addObject({
            browseName: "Green",
            eventNotifier: 0x1,
            notifierOf: addressSpace.rootFolder.objects.server,
            organizedBy: addressSpace.rootFolder.objects
        });
        source = namespace.addObject({ browseName: "Tank", componentOf: green, eventSourceOf: green });
        inputNode = namespace.addVariable({ browseName: "TankLevel", dataType: "Double", propertyOf: source });
        inputNode.setValueFromSource({ dataType: DataType.Double, value: 0 });
    });

    after(() => addressSpace.dispose());

    const makeAlarm = (browseName: string) =>
        namespace.instantiateExclusiveLimitAlarm("ExclusiveLimitAlarmType", {
            browseName,
            conditionSource: source,
            highHighLimit: 100.0,
            highLimit: 10.0,
            inputNode,
            lowLimit: 1.0,
            lowLowLimit: -10.0
        }) as UAExclusiveLimitAlarmEx;

    it("builds a ConditionInfo through the published constructor", () => {
        const info = new ConditionInfo({
            message: "Tank is almost 80% full",
            severity: 100,
            quality: StatusCodes.Good,
            retain: true
        });
        should(info.message?.text).eql("Tank is almost 80% full");
        should(info.severity).eql(100);
        should(info.retain).eql(true);
        // the shape the interface promises, not just a bag of fields
        should(typeof info.isDifferentFrom).eql("function");
    });

    it("takes an assigned calculateConditionInfo when the alarm changes state", () => {
        const alarm = makeAlarm("TankLevelAlarm");

        let asked = 0;
        alarm.calculateConditionInfo = (_stateName, _isActive, value, _old) => {
            asked++;
            return new ConditionInfo({
                message: `Tank level reported as ${value}`,
                severity: 100,
                quality: StatusCodes.Good,
                retain: true
            });
        };

        inputNode.setValueFromSource({ dataType: DataType.Double, value: 50.0 });

        should(asked).be.greaterThan(0, "expecting the assigned calculateConditionInfo to be consulted");
        should(alarm.getCurrentConditionInfo().message?.text).match(/Tank level reported as/);
    });

    it("still honours the deprecated name, so code written against the old documentation keeps working", () => {
        const alarm = makeAlarm("TankLevelAlarmLegacy");

        let asked = 0;
        // the shape the documentation carried for years, assigned on the instance
        (alarm as unknown as { _calculateConditionInfo: () => ConditionInfo })._calculateConditionInfo = () => {
            asked++;
            return new ConditionInfo({ message: "legacy", severity: 1, quality: StatusCodes.Good, retain: true });
        };

        inputNode.setValueFromSource({ dataType: DataType.Double, value: 200.0 });

        should(asked).be.greaterThan(0, "expecting an override of the deprecated name to still win");
        should(alarm.getCurrentConditionInfo().message?.text).eql("legacy");
    });
});
