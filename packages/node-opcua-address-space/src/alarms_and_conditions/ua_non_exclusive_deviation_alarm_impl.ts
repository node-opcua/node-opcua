/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import type { UAVariableT } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { DataValue } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType, VariantOptions } from "node-opcua-variant";
import type { InstallSetPointOptions } from "../../source/interfaces/alarms_and_conditions/install_setpoint_options";
import type { InstantiateLimitAlarmOptions } from "../../source/interfaces/alarms_and_conditions/instantiate_limit_alarm_options";
import type { UANonExclusiveDeviationAlarmEx } from "../../source/interfaces/alarms_and_conditions/ua_non_exclusive_deviation_alarm_ex";
import type { NamespacePrivate } from "../namespace_private";
import {
    DeviationAlarmHelper_getSetpointNodeNode,
    DeviationAlarmHelper_getSetpointValue,
    DeviationAlarmHelper_install_setpoint,
    DeviationAlarmHelper_onSetpointDataValueChange
} from "./deviation_alarm_helper";
import { UALimitAlarmImpl } from "./ua_limit_alarm_impl";
import { UANonExclusiveLimitAlarmImpl, UANonExclusiveLimitAlarmImplBase } from "./ua_non_exclusive_limit_alarm_impl";

export class UANonExclusiveDeviationAlarmImplBase extends UANonExclusiveLimitAlarmImplBase {
    public static instantiate(
        namespace: NamespacePrivate,
        type: string | NodeId,
        options: InstantiateLimitAlarmOptions & InstallSetPointOptions,
        data?: Record<string, VariantOptions>
    ): UANonExclusiveDeviationAlarmImpl {
        const addressSpace = namespace.addressSpace;

        const nonExclusiveDeviationAlarmType = addressSpace.findEventType("NonExclusiveDeviationAlarmType");
        /* c8 ignore next */
        if (!nonExclusiveDeviationAlarmType) {
            throw new Error("cannot find ExclusiveDeviationAlarmType");
        }
        assert(type === nonExclusiveDeviationAlarmType.browseName.toString());

        const alarm = UANonExclusiveLimitAlarmImplBase.instantiate(
            namespace,
            type,
            options,
            data
        ) as UANonExclusiveDeviationAlarmImpl;
        Object.setPrototypeOf(alarm, UANonExclusiveDeviationAlarmImpl.prototype);

        assert(alarm instanceof UANonExclusiveDeviationAlarmImpl);
        assert(alarm instanceof UANonExclusiveLimitAlarmImpl);
        assert(alarm instanceof UALimitAlarmImpl);

        alarm._install_setpoint(options);

        return alarm;
    }

    private get $13() {
        return this as unknown as UANonExclusiveDeviationAlarmEx;
    }
    public _setStateBasedOnInputValue(value: number): void {
        const setpointValue = this.getSetpointValue();
        if (setpointValue === null) {
            throw new Error("Cannot access setpoint Value");
        }
        assert(Number.isFinite(setpointValue), "expecting a valid setpoint value");
        // call base class implementation
        super._setStateBasedOnInputValue(value - setpointValue);
    }

    public getSetpointNodeNode(): UAVariableT<number, DataType.Double> | UAVariableT<number, DataType.Float> | undefined {
        return DeviationAlarmHelper_getSetpointNodeNode.call(this.$13);
    }

    public getSetpointValue(): number | null {
        return DeviationAlarmHelper_getSetpointValue.call(this.$13);
    }

    public _onSetpointDataValueChange(dataValue: DataValue): void {
        DeviationAlarmHelper_onSetpointDataValueChange.call(this.$13, dataValue);
    }

    public _install_setpoint(options: InstallSetPointOptions): void {
        DeviationAlarmHelper_install_setpoint.call(this.$13, options);
    }
}

export type UANonExclusiveDeviationAlarmImpl = UANonExclusiveDeviationAlarmImplBase & UANonExclusiveDeviationAlarmEx;
export const UANonExclusiveDeviationAlarmImpl =
    UANonExclusiveDeviationAlarmImplBase as unknown as new () => UANonExclusiveDeviationAlarmImpl;
