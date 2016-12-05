"use strict";
require("requirish")._(module);

var util = require("util");
var assert = require("assert");
var _ = require("underscore");

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;

/**
 * @module opcua.address_space
 * @class AddressSpace
 */

var UAAlarmConditionBase = require("./alarm_condition").UAAlarmConditionBase;


/**
 *
 * @constructor
 */
function UALimitAlarm() {
    /**
     * @property activeState {TwoStateVariable}
     */

}
util.inherits(UALimitAlarm, UAAlarmConditionBase);

UALimitAlarm.prototype.getHighHighLimit = function () {
    return this.highHighLimit.readValue().value.value;
};
UALimitAlarm.prototype.getHighLimit = function () {
    return this.highLimit.readValue().value.value;
};
UALimitAlarm.prototype.getLowLimit = function () {
    return this.lowLimit.readValue().value.value;
};
UALimitAlarm.prototype.getLowLowLimit = function () {
    return this.lowLowLimit.readValue().value.value;
};

UALimitAlarm.prototype.setHighHighLimit = function (value) {
    assert(this.highHighLimit, "LimitAlarm instance must expose the optional HighHighLimit property");
    this.highHighLimit.setValueFromSource({dataType: this._dataType, value: value});

};
UALimitAlarm.prototype.setHighLimit = function (value) {
    assert(this.highLimit, "LimitAlarm instance must expose the optional HighLimit property");
    this.highLimit.setValueFromSource({dataType: this._dataType, value: value});
};
UALimitAlarm.prototype.setLowLimit = function (value) {
    assert(this.lowLimit, "LimitAlarm instance must expose the optional LowLimit property");
    this.lowLimit.setValueFromSource({dataType: this._dataType, value: value});

};
UALimitAlarm.prototype.setLowLowLimit = function (value) {
    assert(this.lowLowLimit, "LimitAlarm instance must expose the optional LowLowLimit property");
    this.lowLowLimit.setValueFromSource({dataType: this._dataType, value: value});
};

UALimitAlarm.prototype._onInputDataValueChange = function (dataValue) {

    if (dataValue.statusCode !== StatusCodes.Good) {
        // what shall we do ?
        return;
    }
    if (dataValue.value.dataType === DataType.Null) {
        // what shall we do ?
        return;
    }
    assert(_.isFinite(dataValue.value.value));
    var value = dataValue.value;

    assert(false, "must be overriden");
};


exports.UALimitAlarm = UALimitAlarm;

/**
 *
 * @param limitAlarmTypeId
 * @param options
 * @param options.inputNode
 * @param options.optionals
 * @return {UALimitAlarm}
 */
UALimitAlarm.instantiate = function (addressSpace, limitAlarmTypeId, options, data) {


    assert(options.hasOwnProperty("inputNode"), "must provide inputNode"); // must provide a inputNode
    options.optionals = options.optionals || [];
    var count = 0;
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

    //xx assert(options.optionals,"must provide an optionals");
    var alarmNode = UAAlarmConditionBase.instantiate(addressSpace,limitAlarmTypeId, options, data);

    Object.setPrototypeOf(alarmNode, UALimitAlarm.prototype);

    var inputNode = addressSpace._coerceNode(options.inputNode);
    assert(inputNode, "Expecting a valid input node");


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

    var dataType = addressSpace.findCorrespondingBasicDataType(options.inputNode.dataType);
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

    // install inputNode monitoring for
    inputNode.on("value_changed", function (newDataValue, oldDataValue) {
        alarmNode._onInputDataValueChange(newDataValue);
    });
    return alarmNode;
};

