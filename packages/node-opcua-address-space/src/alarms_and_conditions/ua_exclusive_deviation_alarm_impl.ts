/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { DataType, VariantOptions } from "node-opcua-variant";
import { UAExclusiveDeviationAlarm_Base } from "node-opcua-nodeset-ua";
import { UAVariable, UAVariableT } from "node-opcua-address-space-base";
import { AddressSpace } from "../address_space";
import { NamespacePrivate } from "../namespace_private";
import { UAExclusiveDeviationAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_exclusive_deviation_alarm_ex";
import { InstantiateExclusiveLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_exclusive_limit_alarm_options";
import { InstallSetPointOptions } from "../../source/interfaces/alarms_and_conditions/install_setpoint_options";
import {
    DeviationAlarmHelper_getSetpointNodeNode,
    DeviationAlarmHelper_getSetpointValue,
    DeviationAlarmHelper_install_setpoint,
    DeviationAlarmHelper_onSetpointDataValueChange,
} from "./deviation_alarm_helper";

import {  UAExclusiveLimitAlarmImpl } from "./ua_exclusive_limit_alarm_impl";
import {  UALimitAlarmImpl } from "./ua_limit_alarm_impl";



export declare interface UAExclusiveDeviationAlarmImpl extends UAExclusiveDeviationAlarmEx, UAExclusiveLimitAlarmImpl {
    on(eventName: string, eventHandler: any): this;
    get addressSpace(): AddressSpace;
}

export class UAExclusiveDeviationAlarmImpl extends UAExclusiveLimitAlarmImpl implements UAExclusiveDeviationAlarmEx {
    public static instantiate(
        namespace: NamespacePrivate,
        type: string | NodeId,
        options: InstantiateExclusiveLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UAExclusiveDeviationAlarmImpl {
        const addressSpace = namespace.addressSpace;

        const exclusiveDeviationAlarmType = addressSpace.findEventType("ExclusiveDeviationAlarmType");
        /* istanbul ignore next */
        if (!exclusiveDeviationAlarmType) {
            throw new Error("cannot find ExclusiveDeviationAlarmType");
        }

        assert(type === exclusiveDeviationAlarmType.browseName.toString());

        const alarm = UAExclusiveLimitAlarmImpl.instantiate(namespace, type, options, data) as UAExclusiveDeviationAlarmImpl;
        Object.setPrototypeOf(alarm, UAExclusiveDeviationAlarmImpl.prototype);
        assert(alarm instanceof UAExclusiveDeviationAlarmImpl);
        assert(alarm instanceof UAExclusiveLimitAlarmImpl);
        assert(alarm instanceof UALimitAlarmImpl);

        alarm._install_setpoint(options);

        return alarm;
    }

    public getSetpointNodeNode(): UAVariable {
        return DeviationAlarmHelper_getSetpointNodeNode.call(this);
    }

    public getSetpointValue(): number | null {
        return DeviationAlarmHelper_getSetpointValue.call(this);
    }

    public _onSetpointDataValueChange(dataValue: DataValue): void {
        DeviationAlarmHelper_onSetpointDataValueChange.call(this, dataValue);
    }

    public _install_setpoint(options: InstallSetPointOptions): any {
        return DeviationAlarmHelper_install_setpoint.call(this, options);
    }

    public _setStateBasedOnInputValue(value: number): void {
        const setpointValue = this.getSetpointValue();
        if (setpointValue === null) {
            return;
        }
        assert(isFinite(setpointValue));
        // call base class implementation
        UAExclusiveLimitAlarmImpl.prototype._setStateBasedOnInputValue.call(this, value - setpointValue);
    }
}
export interface UAExclusiveDeviationAlarmHelper {
    setpointNode: UAVariableT<NodeId, DataType.NodeId>;
    setpointNodeNode: UAVariable;
}

/*
UAExclusiveDeviationAlarm.prototype.getSetpointNodeNode = DeviationAlarmHelper.getSetpointNodeNode;
UAExclusiveDeviationAlarm.prototype.getSetpointValue = DeviationAlarmHelper.getSetpointValue;
UAExclusiveDeviationAlarm.prototype._onSetpointDataValueChange = DeviationAlarmHelper._onSetpointDataValueChange;
UAExclusiveDeviationAlarm.prototype._install_setpoint = DeviationAlarmHelper._install_setpoint;
 */
