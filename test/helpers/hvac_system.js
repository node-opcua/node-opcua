"use strict";

require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");
var opcua = require("index.js");
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;
var addAnalogDataItem = opcua.addAnalogDataItem;

exports.createHVACSystem = function(address_space) {


    var TemperatureSensorType = address_space.addObjectType({
        browseName:"TemperatureSensor"
    });

    var HVACEnabledEventType = address_space.addEventType({
        browseName:"HVACEnabledEventType"
    });

    var HVACDisabledEventType = address_space.addEventType({
        browseName:"HVACDisabledEventType"
    });

    var HVACModuleType = address_space.addObjectType({
        browseName: "HVACModuleType"
    });


    addAnalogDataItem(HVACModuleType,{
        browseName: "ExteriorTemperature",
        valuePrecision: 0.01,
        instrumentRange: { low: -70, high: 120},
        engineeringUnitsRange: { low: -100, high: 200},
        engineeringUnits: "° Celsius",
        description: "External temperature Sensor",
        dataType: "Double"
    });



    address_space.addVariable(HVACModuleType,{
        browseName: "InteriorTemperature",
        accessLevel: "CurrentRead",
        hasTypeDefinition: TemperatureSensorType,
        minimumSamplingInterval: 500,
        dataType: "Double"
    });

    // EURange (10,+27)
    addAnalogDataItem(HVACModuleType,{
        browseName: "TargetTemperature",
        minimumSamplingInterval: 0, // could be event Based
        dataType: "Double",
        instrumentRange: { low: -70, high: 120},
        engineeringUnitsRange: { low: -100, high: 200}
    });

    address_space.addMethod(HVACModuleType,{
        browseName: "Enable",
        description: "Enable the hvac system",
        alwaysGeneratesEvent: HVACEnabledEventType,
        inputArguments: [],
        outputArguments: []
    });

    address_space.addMethod(HVACModuleType,{
        browseName: "Disable",
        description: "Disable the hvac system",
        alwaysGeneratesEvent: HVACDisabledEventType,
        inputArguments: [],
        outputArguments: []
    });

    address_space.addMethod(HVACModuleType,{
        browseName: "SetTargetTemperature",
        inputArguments: [
            {
                name: "targetTemperature",
                description: {text: "specifies the target temperature"},
                dataType: DataType.Double
            }
        ],
        outputArguments: []
    });

    var myHVAC = HVACModuleType.instantiate({
        browseName: "MyHVAC1"
    });

    // initalize interiorTemperature :
    myHVAC.interiorTemperature.bindVariable({dataType:DataType.Double,value:16});

    myHVAC.targetTemperature.bindVariable({dataType:DataType.Double,value:16});

    // bind the method
    myHVAC.enable.bindMethod(function(inputArguments, context, callback) {
        var myResult = {
            statusCode: StatusCodes.Good
        };
        callback(null,myResult);
    });

    function updateInteriorTemperature() {

        var currentTemp = myHVAC.interiorTemperature.readValue().value.value;

        var targetTemp  = myHVAC.targetTemperature.readValue().value.value;

        var newInteriorTemp =  currentTemp + (targetTemp - currentTemp) /100.0;

        myHVAC.interiorTemperature.setValueFromSource({dataType: DataType.Float, value: newInteriorTemp});

        //xx console.log("Tick = target temp = ",targetTemp," current =",currentTemp," new= ",newInteriorTemp);
    }

    var timerId = setInterval(updateInteriorTemperature,10);


    // bind the method
    myHVAC.setTargetTemperature.bindMethod(function(inputArguments, context, callback) {

        console.log(" In SetTargetTemperature".cyan.bold);
        console.log("inputArguments",inputArguments[0].toString());

        var targetTemperature = inputArguments[0];
        assert(targetTemperature instanceof opcua.Variant);

        var variable = myHVAC.targetTemperature;

        console.log("instrumentRange=",myHVAC.targetTemperature.instrumentRange.readValue().value.toString());
        console.log("instrumentRange=",HVACModuleType.targetTemperature.instrumentRange.readValue().value.toString());

        var s = variable.isValueInRange(targetTemperature);
        if (s !== StatusCodes.Good) {
            console.log(" Invalid Value specified for targetTemperature".red.bold);
            return callback(null, { statusCode: s });
        }


        variable.setValueFromSource(targetTemperature,StatusCodes.Good);

        callback();

    });

    return myHVAC.nodeId.toString();
};