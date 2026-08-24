import type {
    ConditionInfo,
    INamespace,
    Namespace,
    UAAlarmConditionEx,
    UADiscreteAlarm,
    UAObject,
    UAObjectType
} from "node-opcua-address-space";
import { ConditionInfoImpl } from "node-opcua-address-space/dist/src/alarms_and_conditions/condition_info_impl";
import { UAAlarmConditionImpl } from "node-opcua-address-space/dist/src/alarms_and_conditions/ua_alarm_condition_impl";
import type { DataValue } from "node-opcua-data-value";
import { StatusCodes } from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";

import { EnumDeviceHealth } from "../enum_device_health";

export class UADeviceHealthDiagnosticAlarmEx extends UAAlarmConditionImpl implements UAAlarmConditionEx {
    public $device: UAObject;
    getLastDeviceError(): string[] {
        return [];
    }
    public _calculateConditionInfo(
        _states: string | null,
        isActive: boolean,
        value: string,
        _oldConditionInfo: ConditionInfo
    ): ConditionInfo {
        if (!isActive) {
            return new ConditionInfoImpl({
                message: "Back to normal",
                quality: StatusCodes.Good,
                retain: true,
                severity: 0
            });
        } else {
            // build-up state string
            return new ConditionInfoImpl({
                message: value,
                quality: StatusCodes.Good,
                retain: true,
                severity: 150
            });
        }
    }

    public _updateAlarmState(normalStateValue: number, inputValue: number): void {
        const isActive = normalStateValue === inputValue;
        if (isActive === this.activeState.getValue()) {
            // no change => ignore !
            return;
        }

        const stateName = isActive ? "Active" : "Inactive";
        // also raise the event

        // get device node last error info
        if (isActive) {
            const description = this.getLastDeviceError();
            this._signalNewCondition(stateName, isActive, description.join("\n"));
        } else {
            this._signalNewCondition(stateName, isActive, "");
        }
    }
}

export class UAFailureAlarm extends UADeviceHealthDiagnosticAlarmEx {
    public _onInputDataValueChange(newValue: DataValue) {
        const inputValue = newValue.value.value;
        const normalStateValue = EnumDeviceHealth.FAILURE;
        this._updateAlarmState(normalStateValue, inputValue);
    }
}

export class UACheckFunctionAlarm extends UADeviceHealthDiagnosticAlarmEx {
    public _onInputDataValueChange(newValue: DataValue) {
        const inputValue = newValue.value.value;
        const normalStateValue = EnumDeviceHealth.CHECK_FUNCTION;
        this._updateAlarmState(normalStateValue, inputValue);
    }
}
export class UAOffSpecAlarm extends UADeviceHealthDiagnosticAlarmEx {
    public _onInputDataValueChange(newValue: DataValue) {
        const inputValue = newValue.value.value;
        const normalStateValue = EnumDeviceHealth.OFF_SPEC;
        this._updateAlarmState(normalStateValue, inputValue);
    }
}
export class UAMaintenanceRequiredAlarm extends UADeviceHealthDiagnosticAlarmEx {
    public _onInputDataValueChange(newValue: DataValue) {
        const inputValue = newValue.value.value;
        const normalStateValue = EnumDeviceHealth.MAINTENANCE_REQUIRED;
        this._updateAlarmState(normalStateValue, inputValue);
    }
}

interface UADeviceObjectWithHealthChildren extends UAObject {
    deviceHealth?: UAObject;
    deviceHealthAlarms?: UAObject;
}

function _createXXXXAlarm(
    namespace: INamespace,
    deviceNode: UAObject,
    alarmType: UAObjectType,
    browseName: string
): UADiscreteAlarm {
    const deviceNodeWithHealth = deviceNode as UADeviceObjectWithHealthChildren;
    const deviceHealthNode = deviceNodeWithHealth.deviceHealth;
    if (!deviceHealthNode) {
        throw new Error("DeviceHealth must exist");
    }
    const deviceHealthAlarms = deviceNodeWithHealth.deviceHealthAlarms;
    if (!deviceHealthAlarms) {
        throw new Error("deviceHealthAlarms must exist");
    }

    (alarmType as unknown as { isAbstract: boolean }).isAbstract = false;

    if (alarmType.isAbstract) {
        throw new Error(`Alarm Type cannot be abstract ${alarmType.browseName.toString()}`);
    }

    deviceNode.setEventNotifier(1);

    const options = {
        browseName,
        conditionSource: deviceNode,
        inputNode: deviceHealthNode,
        componentOf: deviceHealthAlarms,
        // normalState: normalStateNode,
        optionals: ["ConfirmedState", "Confirm"]
    };

    const n = namespace as Namespace;
    const alarmNode = n.instantiateAlarmCondition(alarmType, options) as UADeviceHealthDiagnosticAlarmEx;

    alarmNode.conditionName.setValueFromSource({
        dataType: DataType.String,
        value: browseName.replace("Alarm", "")
    });

    alarmNode._updateAlarmState = UADeviceHealthDiagnosticAlarmEx.prototype._updateAlarmState;
    alarmNode._calculateConditionInfo = UADeviceHealthDiagnosticAlarmEx.prototype._calculateConditionInfo;
    alarmNode.getLastDeviceError = UADeviceHealthDiagnosticAlarmEx.prototype.getLastDeviceError;

    // Object.setPrototypeOf(alarmNode, UADeviceHealthDiagnosticAlarm.prototype);

    // install inputNode Node monitoring for change
    alarmNode.installInputNodeMonitoring(options.inputNode);
    alarmNode.activeState.setValue(false);
    alarmNode.$device = deviceNode;

    return alarmNode;
}

export function createDeviceHealthAlarms(deviceNode: UAObject): void {
    try {
        const namespace = deviceNode.namespace;
        const addressSpace = namespace.addressSpace;
        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        if (nsDI < 0) {
            throw new Error("Cannot find DI namespace!");
        }
        const checkFunctionAlarmType = addressSpace.findEventType("CheckFunctionAlarmType", nsDI);
        const failureAlarmType = addressSpace.findEventType("FailureAlarmType", nsDI);
        const maintenanceRequiredAlarmType = addressSpace.findEventType("MaintenanceRequiredAlarmType", nsDI);
        const offSpecAlarmType = addressSpace.findEventType("OffSpecAlarmType", nsDI);
        if (!checkFunctionAlarmType || !failureAlarmType || !maintenanceRequiredAlarmType || !offSpecAlarmType) {
            throw new Error("Cannot find one of the DI alarm event types");
        }

        const failureAlarm = _createXXXXAlarm(namespace, deviceNode, failureAlarmType, "FailureAlarm");
        const maintenanceRequiredAlarm = _createXXXXAlarm(
            namespace,
            deviceNode,
            maintenanceRequiredAlarmType,
            "MaintenanceRequiredAlarm"
        );
        const checkFunctionAlarm = _createXXXXAlarm(namespace, deviceNode, checkFunctionAlarmType, "CheckFunctionAlarm");
        const offSpecAlarm = _createXXXXAlarm(namespace, deviceNode, offSpecAlarmType, "OffSpecAlarm");

        type AlarmWithInputChange = UADeviceHealthDiagnosticAlarmEx & {
            _onInputDataValueChange: (newValue: DataValue) => void;
        };
        (failureAlarm as AlarmWithInputChange)._onInputDataValueChange = UAFailureAlarm.prototype._onInputDataValueChange;
        (maintenanceRequiredAlarm as AlarmWithInputChange)._onInputDataValueChange =
            UAMaintenanceRequiredAlarm.prototype._onInputDataValueChange;
        (checkFunctionAlarm as AlarmWithInputChange)._onInputDataValueChange =
            UACheckFunctionAlarm.prototype._onInputDataValueChange;
        (offSpecAlarm as AlarmWithInputChange)._onInputDataValueChange = UAOffSpecAlarm.prototype._onInputDataValueChange;

        /*
            console.log(failureAlarm.toString());
            console.log(maintenanceRequiredAlarm.toString());
            console.log(checkFunctionAlarm.toString());
            console.log(offSpecAlarm.toString());
        */
    } catch (err) {
        console.log("err ", err.message);
        console.log(err);
    }
}
