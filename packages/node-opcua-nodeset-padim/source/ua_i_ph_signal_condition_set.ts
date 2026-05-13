import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface";
import type { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_dictionary_entry_discrete";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IPhSignalConditionSetType i=1061                            |
 * |isAbstract      |true                                                        |
 */
export interface UAIPhSignalConditionSet_Base extends UABaseInterface_Base {
    phMeasuringMethod?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
    sensingElementImpedance?: UAAnalogUnit<number, DataType.Float>;
    sensorCleaningsCounter?: UAProperty<UInt32, DataType.UInt32>;
    sensorNextCalibration?: UAAnalogUnit<UInt32, DataType.UInt32>;
    sensorReferenceImpedance?: UAAnalogUnit<number, DataType.Float>;
    sensorSterilisationsCounter?: UAProperty<UInt32, DataType.UInt32>;
    sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
}
export interface UAIPhSignalConditionSet extends UABaseInterface, UAIPhSignalConditionSet_Base {}