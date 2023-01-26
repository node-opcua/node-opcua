// ----- this file has been automatically generated - do not edit
import { DataType, Variant, VariantOptions } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAAnalogUnitRange } from "node-opcua-nodeset-ua/source/ua_analog_unit_range"
import { EnumChannelMode } from "./enum_channel_mode"
import { EnumChannelState } from "./enum_channel_state"
import { UAElementMonitoring, UAElementMonitoring_Base } from "./ua_element_monitoring"
import { UAChannelModifier } from "./ua_channel_modifier"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ChannelMonitoringType ns=10;i=16               |
 * |isAbstract      |false                                             |
 */
export interface UAChannelMonitoring_Base extends UAElementMonitoring_Base {
    channelMode: UABaseDataVariable<EnumChannelMode, DataType.Int32>;
    channelModifiers?: UAChannelModifier;
    channelState: UABaseDataVariable<EnumChannelState, DataType.Int32>;
    feedOverride: UAAnalogUnitRange<number, DataType.Double>;
    rapidOverride?: UAAnalogUnitRange<number, DataType.Double>;
}
export interface UAChannelMonitoring extends UAElementMonitoring, UAChannelMonitoring_Base {
}