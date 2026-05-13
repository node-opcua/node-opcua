import type { UAAnalogUnitRange } from "node-opcua-nodeset-ua/dist/ua_analog_unit_range";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

import type { EnumChannelMode } from "./enum_channel_mode";
import type { EnumChannelState } from "./enum_channel_state";
import type { UAChannelModifier } from "./ua_channel_modifier";
import type { UAElementMonitoring, UAElementMonitoring_Base } from "./ua_element_monitoring";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ChannelMonitoringType i=16                                  |
 * |isAbstract      |false                                                       |
 */
export interface UAChannelMonitoring_Base extends UAElementMonitoring_Base {
    channelMode: UABaseDataVariable<EnumChannelMode, DataType.Int32>;
    channelModifiers?: UAChannelModifier;
    channelState: UABaseDataVariable<EnumChannelState, DataType.Int32>;
    feedOverride: UAAnalogUnitRange<number, DataType.Double>;
    rapidOverride?: UAAnalogUnitRange<number, DataType.Double>;
}
export interface UAChannelMonitoring extends UAElementMonitoring, UAChannelMonitoring_Base {}