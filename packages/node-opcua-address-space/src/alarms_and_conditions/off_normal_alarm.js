"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */


var util = require("util");
var assert = require("node-opcua-assert");
var _ = require("underscore");

var StatusCodes = require("node-opcua-status-code").StatusCodes;
var DataType = require("node-opcua-variant").DataType;

/**
 * @module opcua.address_space
 * @inherit UADiscreteAlarm
 * @class AddressSpace
 */

var UADiscreteAlarm = require("./discrete_alarm").UADiscreteAlarm;

/**
 * The OffNormalAlarmType is a specialization of the DiscreteAlarmType intended to represent a
 * discrete Condition that is considered to be not normal.
 * This sub type is usually used to indicate that a discrete value is in an Alarm state, it is active as
 * long as a non-normal value is present.
 * @class UAOffNormalAlarm
 * @extends UADiscreteAlarm
 * @constructor
 */
function UAOffNormalAlarm() {
    // HasProperty Variable NormalState NodeId PropertyType Mandatory
    // The NormalState Property is a Property that points to a Variable which has a value that
    // corresponds to one of the possible values of the Variable pointed to by the InputNode
    // Property where the NormalState Property Variable value is the value that is considered to be
    // the normal state of the Variable pointed to by the InputNode Property. When the value of the
    // Variable referenced by the InputNode Property is not equal to the value of the NormalState
    // Property the Alarm is Active. If this Variable is not in the AddressSpace, a Null NodeId shall
    // be provided.
    /**
     * @property NormalState {UAVariableType}
     *
     */
}
util.inherits(UAOffNormalAlarm, UADiscreteAlarm);

/**
 * @method getNormalStateNode
 * @returns {BaseNode}
 */
UAOffNormalAlarm.prototype.getNormalStateNode = function () {
    var nodeId = this.normalState.readValue().value.value;
    var node = this.addressSpace.findNode(nodeId);
    assert(node, "getNormalStateNode ");
    return node;
};

/**
 * @method getNormalStateValue
 * @returns {Any}
 */
UAOffNormalAlarm.prototype.getNormalStateValue = function () {
    var normalStateNode = this.getNormalStateNode();
    return normalStateNode.readValue().value.value;
};

/**
 * @method setNormalStateValue
 * @param value
 */
UAOffNormalAlarm.prototype.setNormalStateValue = function (value) {
    var normalStateNode = this.getNormalStateNode();
    throw new Error("Not Implemented yet");
};
var utils = require("node-opcua-utils");

function isEqual(value1, value2) {
    return value1 === value2;
}
UAOffNormalAlarm.prototype._updateAlarmState = function (normalStateValue, inputValue) {

    var alarm = this;

    if (utils.isNullOrUndefined(normalStateValue) || utils.isNullOrUndefined(inputValue)) {
        this.activeState.setValue(false);
        return;
    }
    var isActive = !isEqual(normalStateValue, inputValue);

    if (isActive === alarm.activeState.getValue()) {
        // no change => ignore !
        return;
    }

    var stateName = isActive ? "Active" : "Inactive";
    // also raise the event
    alarm._signalNewCondition(stateName, isActive, "");

};



UAOffNormalAlarm.prototype._onInputDataValueChange = function (dataValue) {

    if (dataValue.statusCode !== StatusCodes.Good) {
        // what shall we do ?
        return;
    }
    if (dataValue.value.dataType === DataType.Null) {
        // what shall we do ?
        return;
    }
    var inputValue = dataValue.value.value;
    var normalStateValue = this.getNormalStateValue();
    this._updateAlarmState(normalStateValue, inputValue);

};
UAOffNormalAlarm.prototype._onNormalStateDataValueChange = function (dataValue) {

    if (dataValue.statusCode !== StatusCodes.Good) {
        // what shall we do ?
        return;
    }
    if (dataValue.value.dataType === DataType.Null) {
        // what shall we do ?
        return;
    }
    var normalStateValue = dataValue.value.value;
    var inputValue = this.getInputNodeValue();
    this._updateAlarmState(normalStateValue, inputValue);
};


/**
 * @method (static)UAOffNormalAlarm.instantiate
 * @param addressSpace
 * @param limitAlarmTypeId
 * @param options
 * @param options.inputNode   {NodeId|UAVariable} the input node
 * @param options.normalState {NodeId|UAVariable} the normalStateNode node
 * @param data
 *
 * When the value of inputNode doesn't match the normalState node value, then the alarm is raised.
 *
 */
UAOffNormalAlarm.instantiate = function (addressSpace, limitAlarmTypeId, options, data) {


    var offNormalAlarmType = addressSpace.findEventType("OffNormalAlarmType");
    /* istanbul ignore next */
    if (!offNormalAlarmType) {
        throw new Error("cannot find offNormalAlarmType");
    }

    assert(options.hasOwnProperty("inputNode"), "must provide inputNode");          // must provide a inputNode
    assert(options.hasOwnProperty("normalState"), "must provide a normalState Node"); // must provide a inputNode
    options.optionals = options.optionals || [];

    assert(options.hasOwnProperty("inputNode"), "must provide inputNode"); // must provide a inputNode
    var alarmNode = UADiscreteAlarm.instantiate(addressSpace, limitAlarmTypeId, options, data);
    Object.setPrototypeOf(alarmNode, UAOffNormalAlarm.prototype);

    var inputNode = addressSpace._coerceNode(options.inputNode);
    assert(inputNode, "Expecting a valid input node");

    var normalState = addressSpace._coerceNode(options.normalState);
    assert(normalState, "Expecting a valid normalState node");

    alarmNode.normalState.setValueFromSource({ dataType: DataType.NodeId, value: normalState.nodeId });

    // install inputNode Node monitoring for change
    alarmNode._installInputNodeMonitoring(options.inputNode);

    alarmNode.normalState.on("value_changed", function (newDataValue, oldDataValue) {
        // The node that contains the normalState value has changed.
        //   we must remove the listener on current normalState and replace
        //   normalState with the new one and set listener again
        //   to do:
    });

    // install normalState monitoring for change
    normalState.on("value_changed", function (newDataValue, oldDataValue) {
        alarmNode._onNormalStateDataValueChange(newDataValue);
    });

    alarmNode._updateAlarmState();

    return alarmNode;
};

module.exports.UAOffNormalAlarm = UAOffNormalAlarm;


/**
 * @class UASystemOffNormalAlarm
 * @constructor
 * @extends UAOffNormalAlarm
 * This Condition is used by a Server to indicate that an underlying system that is providing  Alarm information is
 * having a communication problem and that the Server may have invalid or incomplete Condition state in the
 * Subscription.
 */
function UASystemOffNormalAlarm() {
}
util.inherits(UASystemOffNormalAlarm, UAOffNormalAlarm);






