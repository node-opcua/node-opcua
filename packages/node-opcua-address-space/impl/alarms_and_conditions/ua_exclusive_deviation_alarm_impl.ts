/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import type { UAVariableT } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import type { DataValue } from "node-opcua-data-value";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType, VariantOptions } from "node-opcua-variant";
import type {
    InstallSetPointOptions,
    SetPointSupport
} from "../../api/interfaces/alarms_and_conditions/install_setpoint_options.js";
import type { InstantiateExclusiveLimitAlarmOptions } from "../../api/interfaces/alarms_and_conditions/instantiate_exclusive_limit_alarm_options.js";
import type { UAExclusiveDeviationAlarmEx } from "../../api/interfaces/alarms_and_conditions/ua_exclusive_deviation_alarm_ex.js";

import type { NamespacePrivate } from "../namespace_private.js";
import {
    DeviationAlarmHelper_getSetpointNodeNode,
    DeviationAlarmHelper_getSetpointValue,
    DeviationAlarmHelper_install_setpoint,
    DeviationAlarmHelper_onSetpointDataValueChange
} from "./deviation_alarm_helper.js";

import { UAExclusiveLimitAlarmImpl, UAExclusiveLimitAlarmImplBase } from "./ua_exclusive_limit_alarm_impl.js";
import { UALimitAlarmImpl } from "./ua_limit_alarm_impl.js";

/** @internal */
export class UAExclusiveDeviationAlarmImplBase extends UAExclusiveLimitAlarmImplBase implements UAExclusiveDeviationAlarmEx {
    /** installed as child nodes by the address space, not assigned here - hence `declare` */
    public declare readonly setpointNode: UAVariableT<NodeId, DataType.NodeId>;
    public declare readonly setpointNodeNode?: UAVariableT<number, DataType.Double> | UAVariableT<number, DataType.Float>;

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
    public getSetpointNodeNode(): UAVariableT<number, DataType.Double> | UAVariableT<number, DataType.Float> | undefined {
        return DeviationAlarmHelper_getSetpointNodeNode.call(this);
    }

    public getSetpointValue(): number | null {
        return DeviationAlarmHelper_getSetpointValue.call(this);
    }

    public _onSetpointDataValueChange(dataValue: DataValue): void {
        DeviationAlarmHelper_onSetpointDataValueChange.call(this, dataValue);
    }

    public _install_setpoint(options: InstallSetPointOptions): void {
        DeviationAlarmHelper_install_setpoint.call(this, options);
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
/** @internal */
export type UAExclusiveDeviationAlarmImpl = UAExclusiveDeviationAlarmImplBase;
/** @internal */
export const UAExclusiveDeviationAlarmImpl = UAExclusiveDeviationAlarmImplBase;
export interface UAExclusiveDeviationAlarmHelper extends SetPointSupport {}
