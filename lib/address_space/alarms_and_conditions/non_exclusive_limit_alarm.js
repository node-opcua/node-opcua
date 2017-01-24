/**
 * @module opcua.address_space.AlarmsAndConditions
 */
import util from "util";
import assert from "assert";
import _ from "underscore";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { DataType } from "lib/datamodel/variant";
import { UALimitAlarm } from "./limit_alarm";
import { DataValue } from "lib/datamodel/datavalue";
import { AddressSpace } from "lib/address_space/address_space";
import { ConditionInfo } from "./condition";

/** *
 * @class  UANonExclusiveLimitAlarm
 * @extends UALimitAlarm
 * @constructor
 */
class UANonExclusiveLimitAlarm extends UALimitAlarm {
  _calculateConditionInfo(states, isActive, value, oldConditionInfo) {
    if (!isActive) {
      return new ConditionInfo({
        severity: 0,
        message: "Back to normal",
        quality: StatusCodes.Good,
        retain: true
      });
    } 
    return new ConditionInfo({
      severity: 150,
      message: `Condition value is ${value} and state is ${states}`,
      quality: StatusCodes.Good,
      retain: true
    });
  }

  _signalNewCondition(states, isActive, value) {
    const alarm = this;

    if (!states) {
      return;
    }
    function _install(name) {
      if (states[name] != "unset") {
        alarm[`${name}State`].setValue(states[name]);
      }
    }

    _install("highHigh");
    _install("high");
    _install("low");
    _install("lowLow");

    super._signalNewCondition(states, isActive, value);
  }

  _setStateBasedOnInputValue(value) {
    assert(_.isFinite(value));

    const alarm = this;

    let isActive = false;

    const states = {
      highHigh: alarm.highHighState ? alarm.highHighState.getValue() : "unset",
      high: alarm.highState ? alarm.highState.getValue() : "unset",
      low: alarm.lowState ? alarm.lowState.getValue() : "unset",
      lowLow: alarm.lowLowState ? alarm.lowLowState.getValue() : "unset"
    };

    let count = 0;

    function ___p(stateName, func_value) {
      if (states[stateName] != "unset") {
        const value = func_value();
        isActive = isActive || value;
        if (states[stateName] != value) {
          states[stateName] = value;
          count += 1;
        }
      }
    }

    ___p("highHigh", () => alarm.getHighHighLimit() < value);
    ___p("high", () => alarm.getHighLimit() < value);
    ___p("low", () => alarm.getLowLimit() > value);
    ___p("lowLow", () => alarm.getLowLowLimit() > value);

    if (count > 0) {
      alarm._signalNewCondition(states, isActive, value);
    }
  }
}


/**
 * @method (static)instantiate
 * @param addressSpace
 * @param type
 * @param options
 * @param data
 * @returns {UANonExclusiveLimitAlarm}
 */
UANonExclusiveLimitAlarm.instantiate = (addressSpace, type, options, data) => {
  options.optionals = options.optionals || [];

  if (options.hasOwnProperty("lowLowLimit")) {
    options.optionals.push("LowLowLimit");
    options.optionals.push("LowLowState");
  }
  if (options.hasOwnProperty("lowLimit")) {
    options.optionals.push("LowLimit");
    options.optionals.push("LowState");
  }
  if (options.hasOwnProperty("highLimit")) {
    options.optionals.push("HighLimit");
    options.optionals.push("HighState");
  }
  if (options.hasOwnProperty("highHighLimit")) {
    options.optionals.push("HighHighLimit");
    options.optionals.push("HighHighState");
  }
  const nonExclusiveAlarmType = addressSpace.findEventType(type);

    /* istanbul ignore next */
  if (!nonExclusiveAlarmType) {
    throw new Error(` cannot find Alarm Condition Type for ${type}`);
  }

  const nonExclusiveLimitAlarmType = addressSpace.findEventType("NonExclusiveLimitAlarmType");
    /* istanbul ignore next */
  if (!nonExclusiveLimitAlarmType) {
    throw new Error("cannot find NonExclusiveLimitAlarmType");
  }
    // assert(type nonExclusiveLimitAlarmType.browseName.toString());

  const alarm = UALimitAlarm.instantiate(addressSpace, type, options, data);
  Object.setPrototypeOf(alarm, UANonExclusiveLimitAlarm.prototype);
  assert(alarm instanceof UALimitAlarm);
  assert(alarm instanceof UANonExclusiveLimitAlarm);

    // ---------------- install States
  if (alarm.lowLowState) {
    AddressSpace._install_TwoStateVariable_machinery(alarm.lowLowState, {
      trueState: "LowLow active",
      falseState: "LowLow inactive"
    });
    alarm.lowLowState.setValue(false);
    assert(alarm.hasOwnProperty("lowLowLimit"));
  }
  if (alarm.lowState) {
    AddressSpace._install_TwoStateVariable_machinery(alarm.lowState, {
      trueState: "Low active",
      falseState: "Low inactive"
    });
    alarm.lowState.setValue(false);
    assert(alarm.hasOwnProperty("lowLimit"));
  }
  if (alarm.highState) {
    AddressSpace._install_TwoStateVariable_machinery(alarm.highState, {
      trueState: "High active",
      falseState: "High inactive"
    });
    alarm.highState.setValue(false);
    assert(alarm.hasOwnProperty("highLimit"));
  }
  if (alarm.highHighState) {
    AddressSpace._install_TwoStateVariable_machinery(alarm.highHighState, {
      trueState: "HighHigh active",
      falseState: "HighHigh inactive"
    });
    alarm.highHighState.setValue(false);
    assert(alarm.hasOwnProperty("highHighLimit"));
  }

  alarm.activeState.setValue(false);

  const currentValue = alarm.getInputNodeNode().readValue();

  alarm._onInputDataValueChange(currentValue);

  return alarm;
};

export { UANonExclusiveLimitAlarm };
