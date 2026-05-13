import type { UAAnalogItem } from "node-opcua-nodeset-ua/dist/ua_analog_item";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAOrderedList } from "node-opcua-nodeset-ua/dist/ua_ordered_list";
import type { DataType } from "node-opcua-variant";

import type { UAStackElement, UAStackElement_Base } from "./ua_stack_element";

// ----- this file has been automatically generated - do not edit

/**
 * Represents an acoustic element in a stacklight.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |StackElementAcousticType i=1007                             |
 * |isAbstract      |false                                                       |
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
    intensity?: UAAnalogItem<number, DataType.Float>;
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
export interface UAStackElementAcoustic extends UAStackElement, UAStackElementAcoustic_Base {}