// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAOrderedList } from "node-opcua-nodeset-ua/source/ua_ordered_list"
import { UAAnalogItem } from "node-opcua-nodeset-ua/source/ua_analog_item"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAStackElement, UAStackElement_Base } from "./ua_stack_element"
/**
 * Represents an acoustic element in a stacklight.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |9:StackElementAcousticType ns=9;i=1007            |
 * |isAbstract      |false                                             |
 */
export interface UAStackElementAcoustic_Base extends UAStackElement_Base {
    /**
     * acousticSignals
     * Contains a list of audio signals used by this
     * acoustic stacklight element.
     */
    acousticSignals: UAOrderedList;
    /**
     * intensity
     * Indicates the sound pressure level of the
     * acoustic signal when switched on. This value
     * shall only have positive values. The mandatory
     * EURange Property of the Variable indicates the
     * lowest and highest value and thereby allows to
     * calculate the percentage represented by the
     * value. The lowest value is interpreted as 0
     * percent, the highest is interpreted as 100
     * percent.
     */
    intensity?: UAAnalogItem<number, /*z*/DataType.Float>;
    /**
     * operationMode
     * Indicates what signal of the list of
     * AcousticSignalType nodes is played when the
     * acoustic element is switched on. It shall contain
     * an index into the NumberInList of the respective
     * AcousticSignalType Object of AcousticSignals.
     */
    operationMode: UABaseDataVariable<any, any>;
}
export interface UAStackElementAcoustic extends UAStackElement, UAStackElementAcoustic_Base {
}