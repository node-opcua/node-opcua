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
 * |typedDefinition |IConductivitySignalConditionSetType i=1062                  |
 * |isAbstract      |true                                                        |
 */
export interface UAIConductivitySignalConditionSet_Base extends UABaseInterface_Base {
    conductivityMeasuringMethod?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
    sensorCleaningsCounter?: UAProperty<UInt32, DataType.UInt32>;
    sensorSterilisationsCounter?: UAProperty<UInt32, DataType.UInt32>;
    sensingElementTemperature?: UAAnalogUnit<number, DataType.Float>;
    temperatureCompensationStyle?: UAMultiStateDictionaryEntryDiscrete<UInt32, DataType.UInt32>;
}
export interface UAIConductivitySignalConditionSet extends UABaseInterface, UAIConductivitySignalConditionSet_Base {}