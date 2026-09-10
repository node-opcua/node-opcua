/**
 * Customising a deviation alarm from outside the package.
 *
 * A deviation alarm watches two nodes: the input node, whose hook `onInputDataValueChange` is
 * published on every alarm, and the setpoint node, whose hook was only ever reachable under
 * the underscore-prefixed name on the implementation class.
 *
 * The imports below are the point of the test, as in test_custom_alarm_hooks.ts: everything an
 * application needs to give a deviation alarm its own behaviour has to be reachable from the
 * package entry points. If any of these names has to come from a deep path again, this stops
 * compiling.
 */
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import should from "should";

import {
    AddressSpace,
    type Namespace,
    type UANonExclusiveDeviationAlarmEx,
    type UAObject,
    type UAVariableT
} from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

describe("deviation alarm hooks", function (this: Mocha.Suite) {
    this.timeout(Math.max(this.timeout(), 30000));

    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let source: UAObject;
    let inputNode: UAVariableT<number, DataType.Double>;
    let setpointNode: UAVariableT<number, DataType.Double>;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        namespace = addressSpace.registerNamespace("Private");
        addressSpace.installAlarmsAndConditionsService();

        // a condition source has to be an event source, otherwise instantiation refuses it
        source = namespace.addObject({
            browseName: "Tank",
            eventSourceOf: addressSpace.rootFolder.objects.server,
            organizedBy: addressSpace.rootFolder.objects
        });
        inputNode = namespace.addVariable({
            browseName: "TankLevel",
            dataType: "Double",
            propertyOf: source
        }) as UAVariableT<number, DataType.Double>;
        setpointNode = namespace.addVariable({
            browseName: "TankLevelSetpoint",
            dataType: "Double",
            propertyOf: source
        }) as UAVariableT<number, DataType.Double>;
    });

    after(() => addressSpace.dispose());

    let counter = 0;
    const makeAlarm = (): UANonExclusiveDeviationAlarmEx => {
        inputNode.setValueFromSource({ dataType: DataType.Double, value: 0 });
        setpointNode.setValueFromSource({ dataType: DataType.Double, value: 0 });
        counter += 1;
        return namespace.instantiateNonExclusiveDeviationAlarm({
            browseName: `TankLevelDeviationAlarm${counter}`,
            conditionSource: source,
            inputNode,
            setpointNode,

            highHighLimit: 100.0,
            highLimit: 10.0,
            lowLimit: -1.0,
            lowLowLimit: -10.0
        });
    };

    it("runs an assigned onSetpointDataValueChange when the setpoint node value changes", () => {
        const alarm = makeAlarm();

        const seen: number[] = [];
        alarm.onSetpointDataValueChange = (dataValue) => {
            seen.push(dataValue.value.value as number);
        };

        setpointNode.setValueFromSource({ dataType: DataType.Double, value: 25.0 });

        should(seen).eql([25.0]);
    });

    it("still honours the deprecated _onSetpointDataValueChange, so a legacy override keeps winning", () => {
        const alarm = makeAlarm();

        let published = 0;
        alarm.onSetpointDataValueChange = () => {
            published++;
        };

        let legacy = 0;
        // the shape a subclass written against the old documentation carried, assigned here on
        // the instance so the test needs no implementation class
        alarm._onSetpointDataValueChange = () => {
            legacy++;
        };

        setpointNode.setValueFromSource({ dataType: DataType.Double, value: 7.0 });

        should(legacy).eql(1, "expecting an override of the deprecated name to still win");
        should(published).eql(0, "expecting the legacy override to shadow the published hook, not to run beside it");
    });

    it("re-evaluates the alarm state when the setpoint moves, with no hook assigned", () => {
        const alarm = makeAlarm();

        // 5 is well inside the -1..10 deviation band around a setpoint of 0
        inputNode.setValueFromSource({ dataType: DataType.Double, value: 5.0 });
        should(alarm.activeState.getValue()).eql(false);
        should(alarm.highState?.getValue()).eql(false);

        // the input has not moved, but a setpoint of -20 puts the deviation at 25, above HighLimit
        setpointNode.setValueFromSource({ dataType: DataType.Double, value: -20.0 });
        should(alarm.activeState.getValue()).eql(true);
        should(alarm.highState?.getValue()).eql(true);

        // and bringing the setpoint back to the input value clears it again
        setpointNode.setValueFromSource({ dataType: DataType.Double, value: 5.0 });
        should(alarm.activeState.getValue()).eql(false);
        should(alarm.highState?.getValue()).eql(false);
    });
});
