/**
 * @module opcua.address_space.AlarmsAndConditions
 */
import util from "util";
import assert from "assert";
import _ from "underscore";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { DataType } from "lib/datamodel/variant";
import { DataValue } from "lib/datamodel/datavalue";
import UALimitAlarm from "./UALimitAlarm";
import { UAStateMachine } from "lib/address_space/state_machine/finite_state_machine";
import { NodeId } from "lib/datamodel/nodeid";
import ConditionInfo from "./ConditionInfo";

/**
 * @class UAExclusiveLimitAlarm
 * @extends UALimitAlarm
 * @constructor
 */
class UAExclusiveLimitAlarm extends UALimitAlarm {
  _signalNewCondition(stateName, isActive, value) {
    const alarm = this;

    assert(validState.indexOf(stateName) >= 0,`must have a valid state : ${stateName}`);

    const oldState   = alarm.limitState.getCurrentState();
    const oldActive  = alarm.activeState.getValue();

    if (stateName) {
      alarm.limitState.setState(stateName);
    } else {
      assert(stateName == null);
      alarm.limitState.setState(stateName);
    }
    super._signalNewCondition(stateName, isActive, value);
  }

  _setStateBasedOnInputValue(value) {
    assert(_.isFinite(value));

    const alarm = this;

    let isActive = false;

    let state = null;

    const oldState = alarm.limitState.getCurrentState();

    if (alarm.highHighLimit && alarm.getHighHighLimit() < value) {
      state = "HighHigh";
      isActive = true;
    } else if (alarm.highLimit && alarm.getHighLimit() < value) {
      state = "High";
      isActive = true;
    } else if (alarm.lowLowLimit && alarm.getLowLowLimit() > value) {
      state = "LowLow";
      isActive = true;
    } else if (alarm.lowLimit && alarm.getLowLimit() > value) {
      state = "Low";
      isActive = true;
    }

    if (state != oldState) {
      alarm._signalNewCondition(state,isActive,value);
    }
  }
}

const validState = ["HighHigh","High","Low","LowLow",null];


/** *
 *
 * @method (static)instantiate
 * @param type
 * @param options
 * @param data
 * @return {UAExclusiveLimitAlarm}
 */
UAExclusiveLimitAlarm.instantiate = (addressSpace, type, options, data) => {
    // xx assert(options.conditionOf,"must provide a conditionOf Node");
  const exclusiveAlarmType = addressSpace.findEventType(type);

    /* istanbul ignore next */
  if (!exclusiveAlarmType) {
    throw new Error(` cannot find Alarm Condition Type for ${type}`);
  }

  const exclusiveLimitAlarmType = addressSpace.findEventType("ExclusiveLimitAlarmType");
    /* istanbul ignore next */
  if (!exclusiveLimitAlarmType) {
    throw new Error("cannot find ExclusiveLimitAlarmType");
  }

  const alarm = UALimitAlarm.instantiate(addressSpace, type, options, data);
  Object.setPrototypeOf(alarm, UAExclusiveLimitAlarm.prototype);
  assert(alarm instanceof UAExclusiveLimitAlarm);
  assert(alarm instanceof UALimitAlarm);

    // ---------------- install LimitState StateMachine
  assert(alarm.limitState, "limitState is mandatory");
  UAStateMachine.promote(alarm.limitState);

    // start with a inactive state
  alarm.activeState.setValue(false);

  const currentValue = alarm.getInputNodeNode().readValue();
  alarm._onInputDataValueChange(currentValue);

  return alarm;
};

export default UAExclusiveLimitAlarm;
