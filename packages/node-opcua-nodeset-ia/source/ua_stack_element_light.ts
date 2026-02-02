// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { EnumSignalColor } from "./enum_signal_color"
import { EnumSignalModeLight } from "./enum_signal_mode_light"
import { DTRGBW } from "./dt_rgbw"
import { UAStackElement, UAStackElement_Base } from "./ua_stack_element"
/**
 * Represents a lamp element in a stacklight.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |StackElementLightType i=1006                                |
 * |isAbstract      |false                                                       |
 */
export interface UAStackElementLight_Base extends UAStackElement_Base {
   // PlaceHolder for $ControlChannel$
    /**
     * intensity
     * Intensity of the lamp, thus its brightness. The
     * mandatory EURange Property of the Variable
     * indicates the lowest and highest value and
     * thereby allows to calculate the percentage
     * represented by the value. The lowest value is
     * interpreted as 0 percent, the highest is
     * interpreted as 100 percent.
     */
    intensity?: UAAnalogItem<number, DataType.Float>;
    /**
     * signalColor
     * Indicates the colour the lamp element has when
     * switched on.
     */
    signalColor?: UABaseDataVariable<EnumSignalColor, DataType.Int32>;
    /**
     * signalMode
     * Shows in what way the lamp is used (continuous
     * light, flashing, blinking) when switched on.
     */
    signalMode?: UABaseDataVariable<EnumSignalModeLight, DataType.Int32>;
    signalRGBWValue?: UABaseDataVariable<DTRGBW, DataType.ExtensionObject>;
}
export interface UAStackElementLight extends UAStackElement, UAStackElementLight_Base {
}