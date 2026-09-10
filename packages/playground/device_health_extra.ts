/**
 * The four DI DeviceHealth alarms (Failure, CheckFunction, OffSpec, MaintenanceRequired) of a
 * device, all watching the same DeviceHealth enumeration variable.
 *
 * It is kept as a worked example of giving an alarm a behaviour of its own from application
 * code: nothing is imported from inside a package, no implementation class is derived from, and
 * the behaviour is installed by assigning the published hooks. The hooks are assigned as
 * closures on purpose - a closure carries the application context (here the device and the
 * diagnostics this module collects for it), which is the one thing a prototype method could
 * never reach without bolting an extra field onto the node.
 */
import {
    ConditionInfo,
    DataType,
    type Namespace,
    NodeClass,
    StatusCodes,
    type UAAlarmConditionEx,
    type UAEventType,
    type UAObject,
    type UAVariable
} from "node-opcua";
import { EnumDeviceHealth } from "node-opcua-nodeset-di";

/**
 * Diagnostics the application gathers elsewhere, deliberately owned by this module rather than
 * stored on the node: the alarm hooks reach it through their closure, which is why the alarms
 * need no `$device` field of their own.
 */
const recentDiagnostics = new Map<UAObject, string[]>();

/** Called by the application whenever the device reports something worth quoting in an alarm. */
export function recordDeviceDiagnostic(deviceNode: UAObject, diagnostic: string): void {
    const history = recentDiagnostics.get(deviceNode) || [];
    // an alarm message is read by a human, so only the tail of the history is worth carrying
    recentDiagnostics.set(deviceNode, [...history, diagnostic].slice(-3));
}

function lastDeviceErrors(deviceNode: UAObject): string {
    const history = recentDiagnostics.get(deviceNode);
    return history && history.length > 0 ? history.join(" / ") : "no diagnostic reported";
}

interface UADeviceObjectWithHealthChildren extends UAObject {
    deviceHealth?: UAVariable;
    deviceHealthAlarms?: UAObject;
}

function installDeviceHealthAlarm(
    namespace: Namespace,
    deviceNode: UADeviceObjectWithHealthChildren,
    alarmType: UAEventType,
    browseName: string,
    alarmingHealth: EnumDeviceHealth
): UAAlarmConditionEx {
    const deviceHealthNode = deviceNode.deviceHealth;
    if (!deviceHealthNode) {
        throw new Error("DeviceHealth must exist");
    }
    const deviceHealthAlarms = deviceNode.deviceHealthAlarms;
    if (!deviceHealthAlarms) {
        throw new Error("deviceHealthAlarms must exist");
    }

    deviceNode.setEventNotifier(1);

    const alarm = namespace.instantiateAlarmCondition(alarmType, {
        browseName,
        componentOf: deviceHealthAlarms,
        conditionSource: deviceNode,
        inputNode: deviceHealthNode,
        optionals: ["ConfirmedState", "Confirm"]
    });

    alarm.conditionName.setValueFromSource({
        dataType: DataType.String,
        value: browseName.replace("Alarm", "")
    });

    // the device is whatever was passed as conditionSource; asking the alarm rather than
    // remembering it separately keeps the two from drifting apart
    const conditionOf = alarm.conditionOfNode();
    const device = conditionOf && conditionOf.nodeClass === NodeClass.Object ? conditionOf : deviceNode;

    alarm.calculateConditionInfo = (_stateName, isActive, value, _oldConditionInfo) =>
        new ConditionInfo({
            message: isActive ? `${browseName}: ${value}` : "Back to normal",
            quality: StatusCodes.Good,
            retain: true,
            severity: isActive ? 150 : 0
        });

    alarm.onInputDataValueChange = (newValue) => {
        const isActive = newValue.value.value === alarmingHealth;
        if (isActive === alarm.activeState.getValue()) {
            // the same health value can be written repeatedly; only the edges are events
            return;
        }
        alarm.signalNewCondition(isActive ? "Active" : "Inactive", isActive, isActive ? lastDeviceErrors(device) : "");
    };

    alarm.installInputNodeMonitoring(deviceHealthNode);
    alarm.activeState.setValue(false);

    return alarm;
}

/**
 * What an application calls once per device, after the DI nodeset has been loaded and the
 * device object built.
 */
export function createDeviceHealthAlarms(deviceNode: UAObject): void {
    const namespace = deviceNode.namespace as Namespace;
    const addressSpace = namespace.addressSpace;
    const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
    if (nsDI < 0) {
        throw new Error("Cannot find DI namespace!");
    }

    const alarms: [string, EnumDeviceHealth][] = [
        ["FailureAlarmType", EnumDeviceHealth.FAILURE],
        ["MaintenanceRequiredAlarmType", EnumDeviceHealth.MAINTENANCE_REQUIRED],
        ["CheckFunctionAlarmType", EnumDeviceHealth.CHECK_FUNCTION],
        ["OffSpecAlarmType", EnumDeviceHealth.OFF_SPEC]
    ];

    for (const [typeName, alarmingHealth] of alarms) {
        const alarmType = addressSpace.findEventType(typeName, nsDI);
        if (!alarmType) {
            throw new Error(`Cannot find DI alarm event type ${typeName}`);
        }
        installDeviceHealthAlarm(
            namespace,
            deviceNode as UADeviceObjectWithHealthChildren,
            alarmType,
            typeName.replace("Type", ""),
            alarmingHealth
        );
    }
}
