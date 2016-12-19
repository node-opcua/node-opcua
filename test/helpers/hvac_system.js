"use strict";

require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");
var opcua = require("index.js");
var StatusCodes = opcua.StatusCodes;
var Variant = opcua.Variant;
var DataType = opcua.DataType;
var DataValue = opcua.DataValue;
var standardUnits = opcua.standardUnits;

var doDebug = false;

/***
 * @method createHVACSystem
 *
 * @startuml
 *
 * class HVACModuleType {
 * }
 * HVACModuleType -up-> ObjectType
 * HVACModuleType o-down-> ExteriorTemperatureSensor     << (P,#F0F0FF)TemperatureSensorType >>
 * HVACModuleType o-down-> InteriorTemperatureSensor     << (P,#F0F0FF)TemperatureSensorType >>
 * HVACModuleType o-down-> TargetTemperature     << (P,#F0F0FF)TemperatureSensorType >>
 * HVACModuleType o-down-> HVACEnabledEventType  << (E,#00F0FF)BaseEventType >>
 * HVACModuleType o-down-> HVACDisabledEventType << (E,#00F0FF)BaseEventType >>
 * HVACModuleType o-left-> SetTargetTemperature<< (M,#ABFFF0) >>
 * HVACModuleType o-left---> Enable  << (M,#ABFFF0) >>
 * HVACModuleType o-left---> Disable << (M,#ABFFF0) >>
 * AnalogItemType -up-> DataItemType
 * DataItemType -up-> BaseDataVariableType
 * @enduml
 *
 * compact version
 * @startuml
 *
 * class HVACModuleType << (C,F0F0F0)ObjectType >> {
 *   ExteriorTemperatureSensor: AnalogItemType
 *   InteriorTemperatureSensor: AnalogItemType
 *   TargetTemperature : Variable
 *   --------
 *   HVACEnabledEventType
 *   HVACDisabledEventType
 *   --------
 *   SetTargetTemperature
 *   Enable
 *   Disable
 * }
 * @enduml
 *
 * @param addressSpace
 * @return {*}
 */
exports.createHVACSystem = function(addressSpace) {


    var HVACEnabledEventType = addressSpace.addEventType({
        browseName:"HVACEnabledEventType"
    });

    var HVACDisabledEventType = addressSpace.addEventType({
        browseName:"HVACDisabledEventType"
    });

    var HVACModuleType = addressSpace.addObjectType({
        browseName: "HVACModuleType"
    });


    addressSpace.addAnalogDataItem({
        componentOf: HVACModuleType,
        browseName: "ExteriorTemperature",
        accessLevel: "CurrentRead",
        valuePrecision: 0.01,
        instrumentRange: { low: -70, high: 120},
        engineeringUnitsRange: { low: -100, high: 200},
        engineeringUnits: standardUnits.degree_celsius, // � Celsius
        description: "External temperature Sensor",
        minimumSamplingInterval: 500,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    addressSpace.addAnalogDataItem({
        componentOf: HVACModuleType,
        browseName: "InteriorTemperature",
        accessLevel: "CurrentRead",
        valuePrecision: 0.01,
        instrumentRange: { low: -70, high: 120},
        engineeringUnitsRange: { low: -100, high: 200},
        engineeringUnits: standardUnits.degree_celsius,
        description: "External temperature Sensor",
        minimumSamplingInterval: 500,
        dataType: "Double",
        modellingRule: "Mandatory"
    });


    // EURange (10,+27)
    addressSpace.addAnalogDataItem({
        modellingRule: "Mandatory",
        componentOf: HVACModuleType,
        browseName: "TargetTemperature",
        minimumSamplingInterval: 0, // could be event Based
        dataType: "Double",
        instrumentRange: { low: -70, high: 120},
        engineeringUnitsRange: { low: -100, high: 200}
    });

    addressSpace.addMethod(HVACModuleType,{
        modellingRule: "Mandatory",
        browseName: "Enable",
        description: "Enable the hvac system",
        alwaysGeneratesEvent: HVACEnabledEventType,
        inputArguments: [],
        outputArguments: []
    });

    addressSpace.addMethod(HVACModuleType,{
        modellingRule: "Mandatory",
        browseName: "Disable",
        description: "Disable the hvac system",
        alwaysGeneratesEvent: HVACDisabledEventType,
        inputArguments: [],
        outputArguments: []
    });

    addressSpace.addMethod(HVACModuleType,{
        modellingRule: "Mandatory",
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

    addressSpace.addTwoStateDiscrete({
        modellingRule: "Mandatory",
        componentOf: HVACModuleType,
        browseName: "MainSwitch",
        trueState: "Up/ON",
        falseState: "Down/OFF",
        value: false
    });


    var myHVAC = HVACModuleType.instantiate({
        browseName: "MyHVAC1"
    });

    // initialize interiorTemperature :
    myHVAC.interiorTemperature.setValueFromSource({dataType:DataType.Double,value:16});

    myHVAC.targetTemperature.setValueFromSource({dataType:DataType.Double,value:16});

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

    myHVAC.on("dispose",function() {
        clearInterval(timerId);
    });

    //xx console.log(" => ",myHVAC.setTargetTemperature.inputArguments.readValue().toString());

    // bind the method
    myHVAC.setTargetTemperature.bindMethod(function(inputArguments, context, callback) {

        if (doDebug) {
            console.log(" In SetTargetTemperature".cyan.bold);
            console.log("inputArguments",inputArguments[0].toString());
        }

        var targetTemperature = inputArguments[0];
        assert(targetTemperature instanceof opcua.Variant);

        var variable = myHVAC.targetTemperature;

        if (doDebug) {
            console.log("instrumentRange=", myHVAC.targetTemperature.instrumentRange.readValue().value.toString());
            console.log("instrumentRange=", HVACModuleType.targetTemperature.instrumentRange.readValue().value.toString());
        }
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