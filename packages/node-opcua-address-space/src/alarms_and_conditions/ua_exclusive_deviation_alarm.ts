/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";

import { UAVariable, UAVariableT } from "../../source";
import { NamespacePrivate } from "../namespace_private";
import {
    DeviationAlarmHelper_getSetpointNodeNode,
    DeviationAlarmHelper_getSetpointValue,
    DeviationAlarmHelper_install_setpoint,
    DeviationAlarmHelper_onSetpointDataValueChange,
    DeviationStuff
} from "./deviation_alarm_helper";
import { UAExclusiveLimitAlarm } from "./ua_exclusive_limit_alarm";
import { UALimitAlarm } from "./ua_limit_alarm";

/**
 * @class UAExclusiveDeviationAlarm
 * @extends UAExclusiveLimitAlarm
 * @constructor
 */
export class UAExclusiveDeviationAlarm extends UAExclusiveLimitAlarm implements DeviationStuff {

    public static instantiate(
      namespace: NamespacePrivate,
      type: string | NodeId,
      options: any,
      data: any
    ): UAExclusiveDeviationAlarm {

        const addressSpace = namespace.addressSpace;

        const exclusiveDeviationAlarmType = addressSpace.findEventType("ExclusiveDeviationAlarmType");
        /* istanbul ignore next */
        if (!exclusiveDeviationAlarmType) {
            throw new Error("cannot find ExclusiveDeviationAlarmType");
        }

        assert(type === exclusiveDeviationAlarmType.browseName.toString());

        const alarm = UAExclusiveLimitAlarm.instantiate(
          namespace, type, options, data) as UAExclusiveDeviationAlarm;
        Object.setPrototypeOf(alarm, UAExclusiveDeviationAlarm.prototype);

        assert(alarm instanceof UAExclusiveDeviationAlarm);
        assert(alarm instanceof UAExclusiveLimitAlarm);
        assert(alarm instanceof UALimitAlarm);

        alarm._install_setpoint(options);

        return alarm;
    }

    public getSetpointNodeNode(): UAVariable {
        return DeviationAlarmHelper_getSetpointNodeNode.call(this);
    }

    public getSetpointValue(): any {
        return DeviationAlarmHelper_getSetpointValue.call(this);
    }

    public _onSetpointDataValueChange(dataValue: DataValue): void {
        DeviationAlarmHelper_onSetpointDataValueChange.call(this, dataValue);
    }

    public _install_setpoint(options: any): any {
        return DeviationAlarmHelper_install_setpoint.call(this, options);
    }

    public _setStateBasedOnInputValue(value: number) {
        const setpointValue = this.getSetpointValue();
        assert(_.isFinite(setpointValue));
        // call base class implementation
        UAExclusiveLimitAlarm.prototype._setStateBasedOnInputValue.call(this, value - setpointValue);
    }
}
export interface UAExclusiveDeviationAlarm {
    setpointNode: UAVariableT<NodeId, DataType.NodeId>;
    setpointNodeNode: UAVariable;
}

/*
UAExclusiveDeviationAlarm.prototype.getSetpointNodeNode = DeviationAlarmHelper.getSetpointNodeNode;
UAExclusiveDeviationAlarm.prototype.getSetpointValue = DeviationAlarmHelper.getSetpointValue;
UAExclusiveDeviationAlarm.prototype._onSetpointDataValueChange = DeviationAlarmHelper._onSetpointDataValueChange;
UAExclusiveDeviationAlarm.prototype._install_setpoint = DeviationAlarmHelper._install_setpoint;
 */
