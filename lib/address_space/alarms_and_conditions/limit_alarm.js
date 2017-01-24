/**
 * @module opcua.address_space.AlarmsAndConditions
 */

import util from "util";
import assert from "assert";
import _ from "underscore";
import { StatusCodes } from "lib/datamodel/opcua_status_code";
import { DataType } from "lib/datamodel/variant";
import { UAAlarmConditionBase } from "./alarm_condition";
import { UAVariable } from "lib/address_space/ua_variable";
import { ConditionInfo } from "./condition";
import { DataValue } from "lib/datamodel/datavalue";
import { NodeId } from "lib/datamodel/nodeid";


/**
 * @class UALimitAlarm
 * @constructor
 * @extends UAAlarmConditionBase
 */
class UALimitAlarm extends UAAlarmConditionBase {
  /**
   * @method getHighHighLimit
   * @return {Number}
   */
  getHighHighLimit() {
    return this.highHighLimit.readValue().value.value;
  }

  /**
   * @method getHighLimit
   * @return {Number}
   */
  getHighLimit() {
    return this.highLimit.readValue().value.value;
  }

  /**
   * @method getLowLimit
   * @return {Float}
   */
  getLowLimit() {
    return this.lowLimit.readValue().value.value;
  }

  /**
   * @method getLowLowLimit
   * @return {Float}
   */
  getLowLowLimit() {
    return this.lowLowLimit.readValue().value.value;
  }

  /**
   * @method setHighHighLimit
   * @param value {Float}
   */
  setHighHighLimit(value) {
    assert(this.highHighLimit, "LimitAlarm instance must expose the optional HighHighLimit property");
    this.highHighLimit.setValueFromSource({ dataType: this._dataType, value });
  }

  /**
   * @method setHighLimit
   * @param value {Float}
   */
  setHighLimit(value) {
    assert(this.highLimit, "LimitAlarm instance must expose the optional HighLimit property");
    this.highLimit.setValueFromSource({ dataType: this._dataType, value });
  }

  /**
   * @method setLowLimit
   * @param value {Float}
   */
  setLowLimit(value) {
    assert(this.lowLimit, "LimitAlarm instance must expose the optional LowLimit property");
    this.lowLimit.setValueFromSource({ dataType: this._dataType, value });
  }

  /**
   * @method setLowLowLimit
   * @param value {Float}
   */
  setLowLowLimit(value) {
    assert(this.lowLowLimit, "LimitAlarm instance must expose the optional LowLowLimit property");
    this.lowLowLimit.setValueFromSource({ dataType: this._dataType, value });
  }

  _onInputDataValueChange(dataValue) {
    assert(dataValue instanceof DataValue);
    const alarm = this;

    if (dataValue.statusCode !== StatusCodes.Good) {
          // what shall we do ?
      return;
    }
    if (dataValue.value.dataType === DataType.Null) {
          // what shall we do ?
      return;
    }
    assert(_.isFinite(dataValue.value.value));
    const value = dataValue.value;

    assert(false, "must be overridden");
  }

  getCurrentConditionInfo() {
    const alarm = this;

    const oldSeverity = alarm.currentBranch().getSeverity();
    const oldQuality = alarm.currentBranch().getQuality();
    const oldMessage = alarm.currentBranch().getMessage();

    const oldConditionInfo = new ConditionInfo({
      severity: oldSeverity,
      quality: oldQuality,
      message: oldMessage
    });

    return oldConditionInfo;
  }

  _onInputDataValueChange(dataValue) {
    assert(dataValue instanceof DataValue);
    const alarm = this;
    if (dataValue.statusCode !== StatusCodes.Good) {
          // what shall we do ?
      alarm._signalNewCondition(null);
      return;
    }
    if (dataValue.value.dataType === DataType.Null) {
          // what shall we do ?
      alarm._signalNewCondition(null);
      return;
    }
    const value = dataValue.value.value;
    alarm._setStateBasedOnInputValue(value);
  }

  /** *
   * @method  _calculateConditionInfo
   * @param stateData {Object}   the new calculated state of the alarm
   * @param isActive  {Boolean}
   * @param value     {Number}   the new value of the limit alarm
   * @param oldCondition  {ConditionInfo} given for information purpose
   * @param oldCondition.severity
   * @param oldCondition.quality
   * @param oldCondition.message
   * @param oldCondition.retain
   * @return {ConditionInfo} the new condition info
   *
   * this method need to be overridden by the instantiate to allow custom message and severity
   * to be set based on specific context of the alarm.
   *
   * @example
   *
   *
   *    var myAlarm = addressSpace.instantiateExclusiveLimitAlarm({...});
   *    myAlarm._calculateConditionInfo = function(stateName,value,oldCondition) {
   *       var percent = Math.ceil(value * 100);
   *       return new ConditionInfo({
   *            message: "Tank is almost " + percent + "% full",
   *            severity: 100,
   *            quality: StatusCodes.Good
   *      });
   *    };
   *
   */
  _calculateConditionInfo(stateData, isActive, value, oldCondition) {
    if (!stateData) {
      return new ConditionInfo({
        severity: 0,
        message: "Back to normal",
        quality: StatusCodes.Good,
        retain: true
      });
    } 
    return new ConditionInfo({
      severity: 150,
      message: `Condition value is ${value} and state is ${stateData}`,
      quality: StatusCodes.Good,
      retain: true
    });
  }

  _signalNewCondition(stateName, isActive, value) {
    const alarm = this;

    const oldConditionInfo = alarm.getCurrentConditionInfo();
    const newConditionInfo = alarm._calculateConditionInfo(stateName, isActive, value, oldConditionInfo);

    if (isActive) {
      alarm.currentBranch().setActiveState(true);
      alarm.currentBranch().setAckedState(false);
      alarm.raiseNewCondition(newConditionInfo);
    } else {
      if (alarm.currentBranch().getAckedState() == false) {
              // prior state need acknowledgement
              // note : TODO : timestamp of branch and new state of current branch must be identical

              // we need to create a new branch so the previous state
              // could be acknowledge
        const newBranch = alarm.createBranch();
        assert(newBranch.getBranchId() != NodeId.NullNodeId);
              // also raised a new Event for the new branch as branchId has changed
        alarm.raiseNewBranchState(newBranch);
      }

      alarm.currentBranch().setActiveState(false);
      alarm.currentBranch().setAckedState(true);

      alarm.raiseNewCondition(newConditionInfo);
    }
  }
}


/**
 * @method (static)UALimitAlarm.instantiate
 * @param addressSpace {AddressSpace}
 * @param limitAlarmTypeId
 * @param options
 * @param options.inputNode
 * @param options.optionals
 * @param options.highHighLimit {Double}
 * @param options.highLimit     {Double}
 * @param options.lowLimit      {Double}
 * @param options.lowLowLimit   {Double}
 * @param data
 * @return {UALimitAlarm}
 */
UALimitAlarm.instantiate = (addressSpace, limitAlarmTypeId, options, data) => {
    // must provide a inputNode
    // xx assert(options.hasOwnProperty("conditionOf")); // must provide a conditionOf
  assert(options.hasOwnProperty("inputNode"), "UALimitAlarm.instantiate: options must provide the inputNode");

  options.optionals = options.optionals || [];
  let count = 0;
  if (options.hasOwnProperty("highHighLimit")) {
    options.optionals.push("HighHighLimit");
    options.optionals.push("HighHighState");
    count++;
  }
  if (options.hasOwnProperty("highLimit")) {
    options.optionals.push("HighLimit");
    options.optionals.push("HighState");
    count++;
  }
  if (options.hasOwnProperty("lowLimit")) {
    options.optionals.push("LowLimit");
    options.optionals.push("LowState");
    count++;
  }
  if (options.hasOwnProperty("lowLowLimit")) {
    options.optionals.push("LowLowLimit");
    options.optionals.push("LowLowState");
    count++;
  }

    // xx assert(options.optionals,"must provide an optionals");
  const alarmNode = UAAlarmConditionBase.instantiate(addressSpace, limitAlarmTypeId, options, data);
  Object.setPrototypeOf(alarmNode, UALimitAlarm.prototype);

  assert(alarmNode.conditionOfNode() != null);

  const inputNode = addressSpace._coerceNode(options.inputNode);
  assert(inputNode, "Expecting a valid input node");
  assert(inputNode instanceof UAVariable);

    // ----------------------- Install Limit Alarm specifics
    // from spec 1.03:
    // Four optional limits are defined that configure the states of the derived limit Alarm Types.
    // These Properties shall be set for any Alarm limits that are exposed by the derived limit Alarm
    // Types. These Properties are listed as optional but at least one is required. For cases where
    // an underlying system cannot provide the actual value of a limit, the limit Property shall still be
    // provided, but will have its AccessLevel set to not readable. It is assumed that the limits are
    // described using the same Engineering Unit that is assigned to the variable that is the source
    // of the alarm. For Rate of change limit alarms, it is assumed this rate is units per second
    // unless otherwise specified.
  if (count === 0) {
    throw new Error("at least one limit is required");
  }

  const dataType = addressSpace.findCorrespondingBasicDataType(options.inputNode.dataType);
  alarmNode._dataType = dataType;

  if (options.hasOwnProperty("highHighLimit")) {
    alarmNode.setHighHighLimit(options.highHighLimit);
  }
  if (options.hasOwnProperty("highLimit")) {
    alarmNode.setHighLimit(options.highLimit);
  }
  if (options.hasOwnProperty("lowLimit")) {
    alarmNode.setLowLimit(options.lowLimit);
  }
  if (options.hasOwnProperty("lowLowLimit")) {
    alarmNode.setLowLowLimit(options.lowLowLimit);
  }

    /**
     *
     *
     * The InputNode Property provides the NodeId of the Variable the Value of which is used as
     * primary input in the calculation of the Alarm state. If this Variable is not in the AddressSpace,
     * a Null NodeId shall be provided. In some systems, an Alarm may be calculated based on
     * multiple Variables Values; it is up to the system to determine which Variable’s NodeId is used.
     * @property inputNode
     * @type     UAVariable
     * dataType is DataType.NodeId
     */
  assert(inputNode instanceof UAVariable);
  alarmNode.inputNode.setValueFromSource({ dataType: "NodeId", value: inputNode.nodeId });

    // install inputNode monitoring for change
  inputNode.on("value_changed", (newDataValue, oldDataValue) => {
    alarmNode._onInputDataValueChange(newDataValue);
  });
  return alarmNode;
};

export { UALimitAlarm };
