// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { UADiscreteItem, UADiscreteItem_Base } from "node-opcua-nodeset-ua/source/ua_discrete_item"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |DiscreteSignalVariableType i=1143                           |
 * |dataType        |Null                                                        |
 * |dataType Name   |(VariantOptions | VariantOptions[]) i=0                     |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UADiscreteSignalVariable_Base<T, DT extends DataType>  extends UADiscreteItem_Base<T, DT> {
    actualValue?: UABaseDataVariable<any, any>;
    simulationValue?: UABaseDataVariable<any, any>;
    simulationState?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UADiscreteSignalVariable<T, DT extends DataType> extends UADiscreteItem<T, DT>, UADiscreteSignalVariable_Base<T, DT> {
}