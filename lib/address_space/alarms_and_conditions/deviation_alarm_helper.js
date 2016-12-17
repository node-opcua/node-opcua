"use strict";
/**
 * @module opcua.address_space.AlarmsAndConditions
 */
require("requirish")._(module);

var assert = require("assert");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("lib/datamodel/variant").DataType;

var DeviationAlarmHelper = {};
DeviationAlarmHelper.getSetpointNodeNode = function() {

    assert(this.setpointNode.readValue().value.dataType === DataType.NodeId);
    var nodeId = this.setpointNode.readValue().value.value;
    var node = this.addressSpace.findNode(nodeId);
    assert(node === this.setpointNodeNode);
    return this.setpointNodeNode;
};
DeviationAlarmHelper.getSetpointValue = function() {
    assert(this.hasOwnProperty("setpointNode"));
    assert(this.hasOwnProperty("setpointNodeNode"));
    var setpointDataValue=this.setpointNodeNode.readValue();
    if (setpointDataValue.statusCode !== StatusCodes.Good) {
        return null;
    }
    return this.getSetpointNodeNode().readValue().value.value;
};
DeviationAlarmHelper._onSetpointDataValueChange = function(dataValue) {
    this._setStateBasedOnInputValue(this.getInputNodeValue());
};

DeviationAlarmHelper._install_setpoint = function(alarm,options) {

    // must provide a set point property
    assert(options.hasOwnProperty("setpointNode"),"must provide a setpointNode");

    var addressSpace = alarm.addressSpace;
    var setpointNodeNode = addressSpace._coerceNode(options.setpointNode);
    assert(setpointNodeNode, "Expecting a valid setpoint node");

    assert(alarm.setpointNode.browseName.toString() === "SetpointNode");

    alarm.setpointNodeNode = addressSpace._coerceNode(options.setpointNode);
    alarm.setpointNode.setValueFromSource({dataType: "NodeId", value: alarm.setpointNodeNode.nodeId});

// install inputNode monitoring for change
    alarm.setpointNodeNode.on("value_changed", function (newDataValue, oldDataValue) {
        alarm._onSetpointDataValueChange(newDataValue);
    });
};

module.exports.DeviationAlarmHelper =DeviationAlarmHelper;
