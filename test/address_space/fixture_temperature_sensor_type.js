"use strict";
require("requirish")._(module);
require("lib/address_space/address_space_add_method");
var should = require("should");
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;


function createTemperatureSensorType(addressSpace) {

    // TemperatureSensorType
    var temperatureSensorTypeNode = addressSpace.addObjectType({browseName: "TemperatureSensorType"});

    addressSpace.addVariable({
        componentOf:    temperatureSensorTypeNode,
        browseName:     "Temperature",
        description:    "the temperature value of the sensor in Celsius <°C>",
        dataType:       "Double",
        modellingRule:  "Mandatory",
        value: new Variant({dataType: DataType.Double, value: 19.5})
    });


    return temperatureSensorTypeNode;

}

exports.createTemperatureSensorType = createTemperatureSensorType;

