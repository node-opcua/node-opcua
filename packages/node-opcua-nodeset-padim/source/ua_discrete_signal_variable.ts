import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UADiscreteItem, UADiscreteItem_Base } from "node-opcua-nodeset-ua/dist/ua_discrete_item";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
export interface UADiscreteSignalVariable<T, DT extends DataType> extends UADiscreteItem<T, DT>, UADiscreteSignalVariable_Base<T, DT> {}