import {
    Namespace,
    UAEventType,
    UAObject,
    UAObjectType,
    UADiscreteAlarm,
    ConditionInfo,
    INamespace,
    UAAlarmConditionEx
} from "node-opcua-address-space";
import {
       StatusCodes
} from "node-opcua-status-code";
import { DataType } from "node-opcua-variant";
import {
    DataValue,
} from "node-opcua-data-value";

  import {
    UAAlarmConditionImpl
} from "node-opcua-address-space/dist/src/alarms_and_conditions/ua_alarm_condition_impl";
import {
    ConditionInfoImpl
} from "node-opcua-address-space/dist/src/alarms_and_conditions/condition_info_impl";

import { EnumDeviceHealth } from "../source/enum_device_health";

export interface UADeviceHealthDiagnosticAlarmEx extends UAAlarmConditionEx {}
export class UADeviceHealthDiagnosticAlarmEx extends UAAlarmConditionImpl {
    public $device: UAObject;
    getLastDeviceError(): string[] {
        return [];
    }
    public _calculateConditionInfo(
        states: string | null,
        isActive: boolean,
        value: string,
        oldConditionInfo: ConditionInfo
    ): ConditionInfo {
        if (!isActive) {
            return new ConditionInfoImpl({
                message: "Back to normal",
                quality: StatusCodes.Good,
                retain: true,
                severity: 0,
            });
        } else {
            // build-up state string
            return new ConditionInfoImpl({
                message: value,
                quality: StatusCodes.Good,
                retain: true,
                severity: 150,
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
            const description =  this.getLastDeviceError();
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

function _createXXXXAlarm(
    namespace: INamespace,
    deviceNode: UAObject,
    alarmType: UAObjectType,
    browseName: string
): UADiscreteAlarm {

    const deviceHealthNode = (deviceNode as any).deviceHealth;
    if (!deviceHealthNode) {
        throw new Error("DeviceHealth must exist");
    }
    const deviceHealthAlarms = (deviceNode as any).deviceHealthAlarms;
    if (!deviceHealthAlarms) {
        throw new Error("deviceHealthAlarms must exist");
    }

    (alarmType as any).isAbstract = false;

    if (alarmType.isAbstract) {
        throw new Error("Alarm Type cannot be abstract " + alarmType.browseName.toString());
    }
    
    deviceNode.setEventNotifier(1);

    const options = {
        browseName,
        conditionSource: deviceNode,
        inputNode: deviceHealthNode,
        componentOf: deviceHealthAlarms,
        // normalState: normalStateNode,
        optionals: ["ConfirmedState", "Confirm"],
    };

    const n = namespace as Namespace;
    const alarmNode = n.instantiateAlarmCondition(alarmType, options) as UADeviceHealthDiagnosticAlarmEx;

    alarmNode.conditionName.setValueFromSource({
        dataType: DataType.String,
        value: browseName.replace("Alarm", ""),
    });

    (alarmNode as any)._updateAlarmState = UADeviceHealthDiagnosticAlarmEx.prototype._updateAlarmState;
    (alarmNode as any)._calculateConditionInfo = UADeviceHealthDiagnosticAlarmEx.prototype._calculateConditionInfo;
    (alarmNode as any).getLastDeviceError = UADeviceHealthDiagnosticAlarmEx.prototype.getLastDeviceError;

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
        const checkFunctionAlarmType = addressSpace.findEventType("CheckFunctionAlarmType", nsDI)!;
        const failureAlarmType = addressSpace.findEventType("FailureAlarmType", nsDI)!;
        const maintenanceRequiredAlarmType = addressSpace.findEventType("MaintenanceRequiredAlarmType", nsDI)!;
        const offSpecAlarmType = addressSpace.findEventType("OffSpecAlarmType", nsDI)!;

        const failureAlarm = _createXXXXAlarm(namespace, deviceNode, failureAlarmType, "FailureAlarm");
        const maintenanceRequiredAlarm = _createXXXXAlarm(
            namespace,
            deviceNode,
            maintenanceRequiredAlarmType,
            "MaintenanceRequiredAlarm"
        );
        const checkFunctionAlarm = _createXXXXAlarm(namespace, deviceNode, checkFunctionAlarmType, "CheckFunctionAlarm");
        const offSpecAlarm = _createXXXXAlarm(namespace, deviceNode, offSpecAlarmType, "OffSpecAlarm");

        (failureAlarm as any)._onInputDataValueChange = UAFailureAlarm.prototype._onInputDataValueChange;
        (maintenanceRequiredAlarm as any)._onInputDataValueChange = UAMaintenanceRequiredAlarm.prototype._onInputDataValueChange;
        (checkFunctionAlarm as any)._onInputDataValueChange = UACheckFunctionAlarm.prototype._onInputDataValueChange;
        (offSpecAlarm as any)._onInputDataValueChange = UAOffSpecAlarm.prototype._onInputDataValueChange;

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
