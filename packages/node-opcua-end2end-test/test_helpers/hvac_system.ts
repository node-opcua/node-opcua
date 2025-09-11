"use strict";

import { IAddressSpace, ISessionContext, SessionContext, UAAnalogItem, UAMethod, UAObject, UAVariableT } from "node-opcua-address-space";
import { adjustDataValueStatusCode } from "node-opcua-address-space/src/data_access/adjust_datavalue_status_code";
import chalk from "chalk";
import { assert } from "node-opcua-assert";
import {
    StatusCodes, DataType, standardUnits, DataValue,
    Variant,
    NodeId
} from "node-opcua";
import { IBaseUAObject } from "../../node-opcua-factory/source";

const doDebug = false;

interface IHVAC extends UAObject{
    nodeId: NodeId;
    enable: UAMethod;
    setTargetTemperature: UAMethod;
    interiorTemperature: UAVariableT<number, DataType.Double>;
    targetTemperature: UAAnalogItem<number, DataType.Double>;

}
/**
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
export function createHVACSystem(addressSpace: IAddressSpace) {
    const namespace = addressSpace.getOwnNamespace() as unknown as any;

    const HVACEnabledEventType = namespace.addEventType({
        browseName: "HVACEnabledEventType"
    });

    const HVACDisabledEventType = namespace.addEventType({
        browseName: "HVACDisabledEventType"
    });

    const HVACModuleType = namespace.addObjectType({
        browseName: "HVACModuleType"
    });

    namespace.addAnalogDataItem({
        componentOf: HVACModuleType,
        browseName: "ExteriorTemperature",
        accessLevel: "CurrentRead",
        valuePrecision: 0.01,
        instrumentRange: { low: -70, high: 120 },
        engineeringUnitsRange: { low: -100, high: 200 },
        engineeringUnits: standardUnits.degree_celsius, // � Celsius
        description: "External temperature Sensor",
        minimumSamplingInterval: 500,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    namespace.addAnalogDataItem({
        componentOf: HVACModuleType,
        browseName: "InteriorTemperature",
        accessLevel: "CurrentRead",
        valuePrecision: 0.01,
        instrumentRange: { low: -70, high: 120 },
        engineeringUnitsRange: { low: -100, high: 200 },
        engineeringUnits: standardUnits.degree_celsius,
        description: "External temperature Sensor",
        minimumSamplingInterval: 500,
        dataType: "Double",
        modellingRule: "Mandatory"
    });

    // EURange (10,+27)
    namespace.addAnalogDataItem({
        modellingRule: "Mandatory",
        componentOf: HVACModuleType,
        browseName: "TargetTemperature",
        minimumSamplingInterval: 0, // could be event Based
        dataType: "Double",
        instrumentRange: { low: -70, high: 120 },
        engineeringUnitsRange: { low: -100, high: 200 }
    });

    namespace.addMethod(HVACModuleType, {
        modellingRule: "Mandatory",
        browseName: "Enable",
        description: "Enable the hvac system",
        alwaysGeneratesEvent: HVACEnabledEventType,
        inputArguments: [],
        outputArguments: []
    });

    namespace.addMethod(HVACModuleType, {
        modellingRule: "Mandatory",
        browseName: "Disable",
        description: "Disable the hvac system",
        alwaysGeneratesEvent: HVACDisabledEventType,
        inputArguments: [],
        outputArguments: []
    });

    namespace.addMethod(HVACModuleType, {
        modellingRule: "Mandatory",
        browseName: "SetTargetTemperature",
        inputArguments: [
            {
                name: "targetTemperature",
                description: { text: "specifies the target temperature" },
                dataType: DataType.Double
            }
        ],
        outputArguments: []
    });

    namespace.addTwoStateDiscrete({
        modellingRule: "Mandatory",
        componentOf: HVACModuleType,
        browseName: "MainSwitch",
        trueState: "Up/ON",
        falseState: "Down/OFF",
        value: false
    });

    const myHVAC = HVACModuleType.instantiate({
        browseName: "MyHVAC1"
    }) as IHVAC;

    // initialize interiorTemperature :
    myHVAC.interiorTemperature.setValueFromSource({ dataType: DataType.Double, value: 16 });

    myHVAC.targetTemperature.setValueFromSource({ dataType: DataType.Double, value: 16 });

    // bind the method
    myHVAC.enable.bindMethod(async (inputArguments: Variant[], sessionContext: ISessionContext) => {
        sessionContext;
        return { statusCode: StatusCodes.Good };
    });

    function updateInteriorTemperature() {
        const currentTemp = myHVAC.interiorTemperature.readValue().value.value;

        const targetTemp = myHVAC.targetTemperature.readValue().value.value;

        const newInteriorTemp = currentTemp + (targetTemp - currentTemp) / 100.0;

        myHVAC.interiorTemperature.setValueFromSource({ dataType: DataType.Double, value: newInteriorTemp });
        //xx console.log("Tick = target temp = ",targetTemp," current =",currentTemp," new= ",newInteriorTemp);
    }

    const timerId = setInterval(updateInteriorTemperature, 60);

    myHVAC.on("dispose", function () {
        clearInterval(timerId);
    });

    //xx console.log(" => ",myHVAC.setTargetTemperature.inputArguments.readValue().toString());

    // bind the method
    myHVAC.setTargetTemperature.bindMethod(async function (inputArguments:Variant[], sessionContext: ISessionContext) {
        sessionContext;
        if (doDebug) {
            console.log(chalk.cyan.bold(" In SetTargetTemperature"));
            console.log("inputArguments", inputArguments[0].toString());
        }

        const targetTemperature = inputArguments[0];
        assert(targetTemperature instanceof Variant);

        const variable = myHVAC.targetTemperature;

        if (doDebug) {
            console.log("instrumentRange=", myHVAC.targetTemperature.instrumentRange!.readValue().value.toString());
            console.log("instrumentRange=", HVACModuleType.targetTemperature.instrumentRange.readValue().value.toString());
        }
        const s = (variable as any).checkVariantCompatibility(targetTemperature);
        if (s.isNot(StatusCodes.Good)) {
            console.log(chalk.red.bold(" Invalid Value specified for targetTemperature " + s.toString()));
            return { statusCode: s };
        }

        const dataValue = new DataValue({ value: targetTemperature });

        const statusCode = adjustDataValueStatusCode(variable as any, dataValue, (variable as any).acceptValueOutOfRange || false);
        if (statusCode.isNotGood()) {
            return { statusCode };
        }
        variable.setValueFromSource(targetTemperature, dataValue.statusCode);
        return { statusCode: StatusCodes.Good };
    });

    return myHVAC.nodeId.toString();
};
