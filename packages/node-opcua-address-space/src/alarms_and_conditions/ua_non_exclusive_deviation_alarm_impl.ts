/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import { assert } from "node-opcua-assert";

import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { VariantOptions } from "node-opcua-variant";
import { UAVariable } from "node-opcua-address-space-base";
import { NamespacePrivate } from "../namespace_private";
import { AddressSpace } from "../address_space";
import { InstantiateLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_limit_alarm_options";
import { UANonExclusiveDeviationAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_non_exclusive_deviation_alarm_ex";
import {
    DeviationAlarmHelper_getSetpointNodeNode,
    DeviationAlarmHelper_getSetpointValue,
    DeviationAlarmHelper_install_setpoint,
    DeviationAlarmHelper_onSetpointDataValueChange
} from "./deviation_alarm_helper";
import { UALimitAlarmImpl } from "./ua_limit_alarm_impl";
import { UANonExclusiveLimitAlarmImpl } from "./ua_non_exclusive_limit_alarm_impl";
export declare interface UANonExclusiveDeviationAlarmImpl extends UANonExclusiveLimitAlarmImpl, UANonExclusiveDeviationAlarmEx {
    on(eventName: string, eventHandler: any): this;
    get addressSpace(): AddressSpace;
}

export class UANonExclusiveDeviationAlarmImpl extends UANonExclusiveLimitAlarmImpl implements UANonExclusiveDeviationAlarmEx {
    public static instantiate(
        namespace: NamespacePrivate,
        type: string | NodeId,
        options: InstantiateLimitAlarmOptions,
        data?: Record<string, VariantOptions>
    ): UANonExclusiveDeviationAlarmImpl {
        const addressSpace = namespace.addressSpace;

        const nonExclusiveDeviationAlarmType = addressSpace.findEventType("NonExclusiveDeviationAlarmType");
        /* istanbul ignore next */
        if (!nonExclusiveDeviationAlarmType) {
            throw new Error("cannot find ExclusiveDeviationAlarmType");
        }
        assert(type === nonExclusiveDeviationAlarmType.browseName.toString());

        const alarm = UANonExclusiveLimitAlarmImpl.instantiate(namespace, type, options, data) as UANonExclusiveDeviationAlarmImpl;
        Object.setPrototypeOf(alarm, UANonExclusiveDeviationAlarmImpl.prototype);

        assert(alarm instanceof UANonExclusiveDeviationAlarmImpl);
        assert(alarm instanceof UANonExclusiveLimitAlarmImpl);
        assert(alarm instanceof UALimitAlarmImpl);

        alarm._install_setpoint(options);

        return alarm;
    }

    public _setStateBasedOnInputValue(value: number): void {
        const setpointValue = this.getSetpointValue();
        if (setpointValue === null) {
            throw new Error("Cannot access setpoint Value");
        }
        assert(isFinite(setpointValue), "expecting a valid setpoint value");
        // call base class implementation
        super._setStateBasedOnInputValue(value - setpointValue);
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

    public _install_setpoint(options: any): any {
        return DeviationAlarmHelper_install_setpoint.call(this, options);
    }
}
