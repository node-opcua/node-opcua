// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { EnumSignalColor } from "./enum_signal_color"
import { EnumSignalModeLight } from "./enum_signal_mode_light"
/**
 * Used for control channels of single colour
 * elements within a stack element (e.g. RGB
 * elements would use three ControlChannels, one for
 * each controllable colour).
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:ControlChannelType ns=9;i=1008                  |
 * |isAbstract      |false                                             |
 */
export interface UAControlChannel_Base {
    /**
     * channelColor
     * Indicates in what mode (continuously on,
     * blinking, flashing) the channel operates when
     * switched on.
     */
    channelColor: UABaseDataVariable<EnumSignalColor, DataType.Int32>;
    /**
     * intensity
     * Shows the channel’s intensity, thus its
     * brightness. The mandatory EURange Property of the
     * Variable indicates the lowest and highest value
     * and thereby allows to calculate the percentage
     * represented by the value. The lowest value is
     * interpreted as 0 percent, the highest is
     * interpreted as 100 percent.
     */
    intensity?: UAAnalogItem<number, DataType.Float>;
    /**
     * signalMode
     * Contains a list of audio signals used by this
     * acoustic stacklight element.
     */
    signalMode: UABaseDataVariable<EnumSignalModeLight, DataType.Int32>;
    /**
     * signalOn
     * Indicates if the colour is switched on.
     */
    signalOn: UAProperty<boolean, DataType.Boolean>;
}
export interface UAControlChannel extends UAObject, UAControlChannel_Base {
}