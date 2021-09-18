/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import { assert } from "node-opcua-assert";

import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import { UANonExclusiveDeviationAlarm_Base, UANonExclusiveLimitAlarm_Base } from "node-opcua-nodeset-ua";

import { UAVariable, UAVariableT } from "../../source";
import { NamespacePrivate } from "../namespace_private";
import { AddressSpace } from "../address_space";
import {
    DeviationAlarmHelper_getSetpointNodeNode,
    DeviationAlarmHelper_getSetpointValue,
    DeviationAlarmHelper_install_setpoint,
    DeviationAlarmHelper_onSetpointDataValueChange,
    DeviationStuff
} from "./deviation_alarm_helper";
import { UALimitAlarmImpl } from "./ua_limit_alarm_impl";
import { UANonExclusiveLimitAlarmEx, UANonExclusiveLimitAlarmImpl } from "./ua_non_exclusive_limit_alarm_impl";

export interface UANonExclusiveDeviationAlarmEx
    extends Omit<
            UANonExclusiveDeviationAlarm_Base,
            | "ackedState"
            | "activeState"
            | "confirmedState"
            | "enabledState"
            | "latchedState"
            | "limitState"
            | "outOfServiceState"
            | "shelvingState"
            | "silenceState"
            | "suppressedState"
            //
            | "highHighState"
            | "highState"
            | "lowState"
            | "lowLowState"
        >,
        UANonExclusiveLimitAlarmEx,
        DeviationStuff {
    setpointNode: UAVariableT<NodeId, DataType.NodeId>;
    setpointNodeNode: UAVariable;
}

export declare interface UANonExclusiveDeviationAlarmImpl extends UANonExclusiveLimitAlarmImpl, UANonExclusiveDeviationAlarmEx {
    on(eventName: string, eventHandler: any): this;
    get addressSpace(): AddressSpace;
}

export class UANonExclusiveDeviationAlarmImpl extends UANonExclusiveLimitAlarmImpl implements UANonExclusiveDeviationAlarmEx {
    public static instantiate(
        namespace: NamespacePrivate,
        type: string | NodeId,
        options: any,
        data: any
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
