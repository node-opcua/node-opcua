// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { DTEnumValue } from "node-opcua-nodeset-ua/source/dt_enum_value"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { UAMultiStateDictionaryEntryDiscrete } from "node-opcua-nodeset-ua/source/ua_multi_state_dictionary_entry_discrete"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/source/ua_analog_unit"
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
export interface UAIConductivitySignalConditionSet extends UABaseInterface, UAIConductivitySignalConditionSet_Base {
}