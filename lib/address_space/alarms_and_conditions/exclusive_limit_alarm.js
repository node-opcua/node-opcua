/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);
const util = require("util");
const assert = require("assert");
const _ = require("underscore");

const StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
const DataType = require("lib/datamodel/variant").DataType;
const DataValue = require("lib/datamodel/datavalue").DataValue;
const UALimitAlarm = require("./limit_alarm").UALimitAlarm;
const UAStateMachine = require("lib/address_space/state_machine/finite_state_machine").UAStateMachine;
const NodeId = require("lib/datamodel/nodeid").NodeId;


const ConditionInfo = require("./condition").ConditionInfo;

/**
 * @class UAExclusiveLimitAlarm
 * @extends UALimitAlarm
 * @constructor
 */
function UAExclusiveLimitAlarm() {
    /**
     * @property limitState
     * @type  UAStateMachine
     */
}
util.inherits(UAExclusiveLimitAlarm, UALimitAlarm);

const validState = ["HighHigh","High","Low","LowLow",null];


UAExclusiveLimitAlarm.prototype._signalNewCondition = function (stateName, isActive, value) {
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
  UALimitAlarm.prototype._signalNewCondition.call(this,stateName,isActive,value);
};

UAExclusiveLimitAlarm.prototype._setStateBasedOnInputValue = function (value) {
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
};


exports.UAExclusiveLimitAlarm = UAExclusiveLimitAlarm;

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
