// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTXV } from "./dt_xv"
import { DTAxisInformation } from "./dt_axis_information"
import { UAArrayItem, UAArrayItem_Base } from "./ua_array_item"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |XYArrayItemType i=12038                                     |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTXV[] i=12080                                              |
 * |value rank      |1                                                           |
 * |isAbstract      |false                                                       |
 */
export interface UAXYArrayItem_Base<T extends DTXV[]>  extends UAArrayItem_Base<T, DataType.ExtensionObject> {
    xAxisDefinition: UAProperty<DTAxisInformation, DataType.ExtensionObject>;
}
export interface UAXYArrayItem<T extends DTXV[]> extends UAArrayItem<T, DataType.ExtensionObject>, UAXYArrayItem_Base<T> {
}