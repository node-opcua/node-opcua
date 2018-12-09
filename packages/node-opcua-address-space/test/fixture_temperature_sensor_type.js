"use strict";

require("..");
const should = require("should");
const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;


function createTemperatureSensorType(addressSpace) {

    const namespace = addressSpace.getOwnNamespace();

    // TemperatureSensorType
    const temperatureSensorTypeNode = namespace.addObjectType({browseName: "TemperatureSensorType"});

    namespace.addVariable({
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

