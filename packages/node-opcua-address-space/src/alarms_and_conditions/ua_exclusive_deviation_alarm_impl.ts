/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import type { UAVariableT } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { DataValue } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType, VariantOptions } from "node-opcua-variant";
import type { DeviationStuff } from "../../source/interfaces/alarms_and_conditions/deviation_stuff";
import type {
    InstallSetPointOptions,
    SetPointSupport
} from "../../source/interfaces/alarms_and_conditions/install_setpoint_options";
import type { InstantiateExclusiveLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_exclusive_limit_alarm_options";
import type { UAExclusiveDeviationAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_exclusive_deviation_alarm_ex";

import type { NamespacePrivate } from "../namespace_private";
import {
    DeviationAlarmHelper_getSetpointNodeNode,
    DeviationAlarmHelper_getSetpointValue,
    DeviationAlarmHelper_install_setpoint,
    DeviationAlarmHelper_onSetpointDataValueChange
} from "./deviation_alarm_helper";

import { UAExclusiveLimitAlarmImpl, UAExclusiveLimitAlarmImplBase } from "./ua_exclusive_limit_alarm_impl";
import { UALimitAlarmImpl } from "./ua_limit_alarm_impl";

export class UAExclusiveDeviationAlarmImplBase extends UAExclusiveLimitAlarmImplBase {
    public static instantiate(
        namespace: NamespacePrivate,
        type: string | NodeId,
        options: InstantiateExclusiveLimitAlarmOptions & InstallSetPointOptions,
        data?: Record<string, VariantOptions>
    ): UAExclusiveDeviationAlarmImpl {
        const addressSpace = namespace.addressSpace;

        const exclusiveDeviationAlarmType = addressSpace.findEventType("ExclusiveDeviationAlarmType");
        /* c8 ignore next */
        if (!exclusiveDeviationAlarmType) {
            throw new Error("cannot find ExclusiveDeviationAlarmType");
        }

        assert(type === exclusiveDeviationAlarmType.browseName.toString());

        const alarm = UAExclusiveLimitAlarmImplBase.instantiate(
            namespace,
            type,
            options,
            data
        ) as unknown as UAExclusiveDeviationAlarmImplBase;
        Object.setPrototypeOf(alarm, UAExclusiveDeviationAlarmImpl.prototype);
        assert(alarm instanceof UAExclusiveDeviationAlarmImpl);
        assert(alarm instanceof UAExclusiveLimitAlarmImpl);
        assert(alarm instanceof UALimitAlarmImpl);

        alarm._install_setpoint(options);

        return alarm as UAExclusiveDeviationAlarmImpl;
    }

    private get $16() {
        return this as unknown as UAExclusiveDeviationAlarmEx & DeviationStuff;
    }
    public getSetpointNodeNode(): UAVariableT<number, DataType.Double> | UAVariableT<number, DataType.Float> | undefined {
        return DeviationAlarmHelper_getSetpointNodeNode.call(this.$16);
    }

    public getSetpointValue(): number | null {
        return DeviationAlarmHelper_getSetpointValue.call(this.$16);
    }

    public _onSetpointDataValueChange(dataValue: DataValue): void {
        DeviationAlarmHelper_onSetpointDataValueChange.call(this.$16, dataValue);
    }

    public _install_setpoint(options: InstallSetPointOptions): void {
        DeviationAlarmHelper_install_setpoint.call(this.$16, options);
    }

    public _setStateBasedOnInputValue(value: number): void {
        const setpointValue = this.getSetpointValue();
        if (setpointValue === null) {
            return;
        }
        assert(Number.isFinite(setpointValue));
        // call base class implementation
        UAExclusiveLimitAlarmImpl.prototype._setStateBasedOnInputValue.call(this, value - setpointValue);
    }
}
export type UAExclusiveDeviationAlarmImpl = UAExclusiveDeviationAlarmImplBase & UAExclusiveDeviationAlarmEx;
export const UAExclusiveDeviationAlarmImpl =
    UAExclusiveDeviationAlarmImplBase as unknown as new () => UAExclusiveDeviationAlarmImpl;
export interface UAExclusiveDeviationAlarmHelper extends SetPointSupport {}
