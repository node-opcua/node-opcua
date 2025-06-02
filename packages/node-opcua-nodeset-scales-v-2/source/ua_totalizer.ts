// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTAbstractWeight } from "./dt_abstract_weight"
import { UAMeasuredItem } from "./ua_measured_item"
/**
 * Contains the sum over the last measurement
 * results.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TotalizerType i=27                                          |
 * |isAbstract      |false                                                       |
 */
export interface UATotalizer_Base {
    resetTotalizer?: UAMethod;
    /**
     * totalizedValue
     * Defines a summed up/totalized volume within a
     * period of time.
     */
    totalizedValue: UAMeasuredItem<DTAbstractWeight, DataType.ExtensionObject>;
}
export interface UATotalizer extends UAObject, UATotalizer_Base {
}