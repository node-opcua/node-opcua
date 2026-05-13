import type { UAProperty } from "node-opcua-address-space-base";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IRamanSignalConditionSetType i=1154                         |
 * |isAbstract      |true                                                        |
 */
export interface UAIRamanSignalConditionSet_Base extends UABaseInterface_Base {
    sourceResidualLife?: UAProperty<number, DataType.Float>;
    sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
    mahalanobisDistance?: UAProperty<number, DataType.Float>;
    spectralResidual?: UAProperty<number, DataType.Float>;
    electronicsReadNoise?: UAProperty<number, DataType.Float>;
}
export interface UAIRamanSignalConditionSet extends UABaseInterface, UAIRamanSignalConditionSet_Base {}