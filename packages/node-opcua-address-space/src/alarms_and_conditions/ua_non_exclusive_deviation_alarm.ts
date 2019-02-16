/**
 * @module node-opcua-address-space.AlarmsAndConditions
 */

import * as _ from "underscore";

import { assert } from "node-opcua-assert";

import { DataValue } from "node-opcua-data-value";
import { NodeId } from "node-opcua-nodeid";
import { UAVariable, UAVariableT } from "../../source";
import { NamespacePrivate } from "../namespace_private";
import {
    DeviationAlarmHelper_getSetpointNodeNode,
    DeviationAlarmHelper_getSetpointValue,
    DeviationAlarmHelper_install_setpoint,
    DeviationAlarmHelper_onSetpointDataValueChange,
    DeviationStuff
} from "./deviation_alarm_helper";
import { UALimitAlarm } from "./ua_limit_alarm";
import { UANonExclusiveLimitAlarm } from "./ua_non_exclusive_limit_alarm";

export interface UANonExclusiveDeviationAlarm extends UANonExclusiveLimitAlarm {
    setpointNode: UAVariableT<NodeId>;
    setpointNodeNode: UAVariable;
}

/**
 * @class UANonExclusiveDeviationAlarm
 * @extends UANonExclusiveLimitAlarm
 * @constructor
 */
export class UANonExclusiveDeviationAlarm extends UANonExclusiveLimitAlarm implements DeviationStuff  {

    public static instantiate(
      namespace: NamespacePrivate,
      type: string | NodeId,
      options: any,
      data: any): UANonExclusiveDeviationAlarm {

        const addressSpace = namespace.addressSpace;

        const nonExclusiveDeviationAlarmType = addressSpace.findEventType("NonExclusiveDeviationAlarmType");
        /* istanbul ignore next */
        if (!nonExclusiveDeviationAlarmType) {
            throw new Error("cannot find ExclusiveDeviationAlarmType");
        }
        assert(type === nonExclusiveDeviationAlarmType.browseName.toString());

        const alarm = UANonExclusiveLimitAlarm.instantiate(
          namespace, type, options, data) as UANonExclusiveDeviationAlarm;
        Object.setPrototypeOf(alarm, UANonExclusiveDeviationAlarm.prototype);

        assert(alarm instanceof UANonExclusiveDeviationAlarm);
        assert(alarm instanceof UANonExclusiveLimitAlarm);
        assert(alarm instanceof UALimitAlarm);

        alarm._install_setpoint(options);

        return alarm;
    }


    public _setStateBasedOnInputValue(value: number) {
        const setpointValue = this.getSetpointValue();
        if (setpointValue === null) {
            throw new Error("Cannot access setpoint Value");
        }
        assert(_.isFinite(setpointValue), "expecting a valid setpoint value");
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
/*
UANonExclusiveDeviationAlarm.prototype.getSetpointNodeNode = DeviationAlarmHelper.getSetpointNodeNode;
UANonExclusiveDeviationAlarm.prototype.getSetpointValue = DeviationAlarmHelper.getSetpointValue;
UANonExclusiveDeviationAlarm.prototype._onSetpointDataValueChange = DeviationAlarmHelper._onSetpointDataValueChange;
UANonExclusiveDeviationAlarm.prototype._install_setpoint = DeviationAlarmHelper._install_setpoint;
*/
