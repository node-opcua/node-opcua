/**
 * Customising an alarm from outside the package.
 *
 * An application that wants an alarm of its own used to have to reach for
 * `node-opcua-address-space/dist/impl/alarms_and_conditions/...`, derive from the
 * implementation class and override underscore-prefixed methods, because the extension points
 * were not published anywhere else.
 *
 * The imports below are the point of the test: everything an application needs to give an
 * alarm its own behaviour has to be reachable from the package entry points. If any of these
 * names has to come from a deep path again, this stops compiling.
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
    type UAAlarmConditionEx,
    type UAObject,
    type UAVariable
} from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

describe("custom alarm hooks", function (this: Mocha.Suite) {
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
        source = namespace.addObject({ browseName: "Boiler", componentOf: green, eventSourceOf: green });
        inputNode = namespace.addVariable({ browseName: "BoilerTemperature", dataType: "Double", propertyOf: source });
        inputNode.setValueFromSource({ dataType: DataType.Double, value: 0 });
    });

    after(() => addressSpace.dispose());

    const makeAlarm = (browseName: string) =>
        namespace.instantiateAlarmCondition("AlarmConditionType", {
            browseName,
            conditionSource: source,
            inputNode
        }) as UAAlarmConditionEx;

    it("runs an assigned onInputDataValueChange when the input node value changes", () => {
        const alarm = makeAlarm("BoilerTemperatureAlarm1");

        const seen: number[] = [];
        alarm.onInputDataValueChange = (newValue) => {
            seen.push(newValue.value.value as number);
        };

        inputNode.setValueFromSource({ dataType: DataType.Double, value: 42.0 });

        should(seen).eql([42.0]);
    });

    it("lets the two hooks work together: onInputDataValueChange decides, calculateConditionInfo words it", () => {
        const alarm = makeAlarm("BoilerTemperatureAlarm2");

        alarm.onInputDataValueChange = (newValue) => {
            const temperature = newValue.value.value as number;
            const tooHot = temperature > 80;
            if (tooHot !== alarm.activeState.getValue()) {
                alarm.signalNewCondition(tooHot ? "Active" : "Inactive", tooHot, temperature.toFixed(1));
            }
        };
        alarm.calculateConditionInfo = (stateName, _isActive, value, _oldConditionInfo) =>
            new ConditionInfo({
                message: `Boiler is ${stateName} at ${value} degrees`,
                severity: 200,
                quality: StatusCodes.Good,
                retain: true
            });

        inputNode.setValueFromSource({ dataType: DataType.Double, value: 91.5 });

        should(alarm.activeState.getValue()).eql(true);
        should(alarm.getCurrentConditionInfo().message?.text).eql("Boiler is Active at 91.5 degrees");
        should(alarm.getCurrentConditionInfo().severity).eql(200);
    });

    it("still honours the deprecated _onInputDataValueChange, so a legacy override keeps winning", () => {
        const alarm = makeAlarm("BoilerTemperatureAlarm3");

        let published = 0;
        alarm.onInputDataValueChange = () => {
            published++;
        };

        let legacy = 0;
        // the shape a subclass written against the old documentation carried, assigned here on
        // the instance so the test needs no implementation class
        (alarm as unknown as { _onInputDataValueChange: (newValue: unknown) => void })._onInputDataValueChange = () => {
            legacy++;
        };

        inputNode.setValueFromSource({ dataType: DataType.Double, value: 13.0 });

        should(legacy).eql(1, "expecting an override of the deprecated name to still win");
        should(published).eql(0, "expecting the legacy override to shadow the published hook, not to run beside it");
    });

    it("lets application code call signalNewCondition directly", () => {
        const alarm = makeAlarm("BoilerTemperatureAlarm4");

        const raised: string[] = [];
        alarm.calculateConditionInfo = (_stateName, _isActive, value, _oldConditionInfo) => {
            raised.push(value);
            return new ConditionInfo({
                message: value,
                severity: 100,
                quality: StatusCodes.Good,
                retain: true
            });
        };

        alarm.signalNewCondition("Active", true, "manual trip");

        should(raised).eql(["manual trip"]);
        should(alarm.activeState.getValue()).eql(true);
        should(alarm.getCurrentConditionInfo().message?.text).eql("manual trip");

        // raising an event that reports nothing new is a caller bug, and says so
        should(() => alarm.signalNewCondition("Active", true, "manual trip")).throwError(/condition values have not change/);
    });
});
