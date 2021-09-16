// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAStackElement, UAStackElement_Base } from "./ua_stack_element"
/**
 * Represents a lamp element in a stacklight.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:StackElementLightType ns=9;i=1006               |
 * |isAbstract      |false                                             |
 */
export interface UAStackElementLight_Base extends UAStackElement_Base {
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
    intensity?: UAAnalogItem<number, /*z*/DataType.Float>;
    /**
     * signalColor
     * Indicates the colour the lamp element has when
     * switched on.
     */
    signalColor?: UABaseDataVariable<any, any>;
    /**
     * signalMode
     * Shows in what way the lamp is used (continuous
     * light, flashing, blinking) when switched on.
     */
    signalMode?: UABaseDataVariable<any, any>;
}
export interface UAStackElementLight extends UAStackElement, UAStackElementLight_Base {
}