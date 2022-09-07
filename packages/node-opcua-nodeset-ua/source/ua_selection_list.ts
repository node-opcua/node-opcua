// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UABaseDataVariable, UABaseDataVariable_Base } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |SelectionListType ns=0;i=16309                    |
 * |dataType        |Null                                              |
 * |dataType Name   |VariantOptions ns=0;i=0                           |
 * |isAbstract      |false                                             |
 */
export interface UASelectionList_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    selections: UAProperty<any, any>;
    selectionDescriptions?: UAProperty<LocalizedText[], DataType.LocalizedText>;
    restrictToList?: UAProperty<boolean, DataType.Boolean>;
}
export interface UASelectionList<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UASelectionList_Base<T, DT> {
}