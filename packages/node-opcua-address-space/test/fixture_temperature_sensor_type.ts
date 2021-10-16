import "should";

import { Double } from "node-opcua-basic-types";
import { DataType, Variant } from "node-opcua-variant";
import { AddressSpace, InstantiateObjectOptions, UAObject, UAObjectType, UAVariableT } from "..";

export interface TemperatureSensor extends UAObject {
    temperature: UAVariableT<Double, DataType.Double>;
}

export interface TemperatureSensorType extends UAObjectType {
    temperature: UAVariableT<Double, DataType.Double>;
    instantiate(options: InstantiateObjectOptions): TemperatureSensor;
}

export function createTemperatureSensorType(addressSpace: AddressSpace): TemperatureSensorType {
    const namespace = addressSpace.getOwnNamespace();

    // TemperatureSensorType
    const temperatureSensorTypeNode = namespace.addObjectType({
        browseName: "TemperatureSensorType"
    }) as TemperatureSensorType;

    namespace.addVariable({
        browseName: "Temperature",
        componentOf: temperatureSensorTypeNode,
        dataType: "Double",
        description: "the temperature value of the sensor in Celsius <°C>",
        modellingRule: "Mandatory",
        value: new Variant({ dataType: DataType.Double, value: 19.5 })
    });

    return temperatureSensorTypeNode;
}
