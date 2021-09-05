// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTXV } from "./dt_xv"
import { DTAxisInformation } from "./dt_axis_information"
import { UAArrayItem, UAArrayItem_Base } from "./ua_array_item"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |XYArrayItemType ns=0;i=12038                      |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTXV[] ns=0;i=12080                               |
 * |isAbstract      |false                                             |
 */
export interface UAXYArrayItem_Base<T extends DTXV[]/*j*/>  extends UAArrayItem_Base<T, /*e*/DataType.ExtensionObject> {
    xAxisDefinition: UAProperty<DTAxisInformation, /*z*/DataType.ExtensionObject>;
}
export interface UAXYArrayItem<T extends DTXV[]/*j*/> extends UAArrayItem<T, /*n*/DataType.ExtensionObject>, UAXYArrayItem_Base<T /*B*/> {
}