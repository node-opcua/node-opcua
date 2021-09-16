// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UAAnalyserDevice_parameterSet, UAAnalyserDevice, UAAnalyserDevice_Base } from "./ua_analyser_device"
export interface UASpectrometerDevice_parameterSet extends UAAnalyserDevice_parameterSet { // Object
      spectralRange?: UADataItem<DTRange[], /*z*/DataType.ExtensionObject>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |2:SpectrometerDeviceType ns=2;i=1011              |
 * |isAbstract      |false                                             |
 */
export interface UASpectrometerDevice_Base extends UAAnalyserDevice_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet?: UASpectrometerDevice_parameterSet;
    factorySettings: UAFunctionalGroup;
}
export interface UASpectrometerDevice extends Omit<UAAnalyserDevice, "parameterSet"|"factorySettings">, UASpectrometerDevice_Base {
}