// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UATwoStateDiscrete, UATwoStateDiscrete_Base } from "node-opcua-nodeset-ua/source/ua_two_state_discrete"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TwoStateDiscreteSignalVariableType i=1141                   |
 * |dataType        |Boolean                                                     |
 * |dataType Name   |boolean i=1                                                 |
 * |isAbstract      |false                                                       |
 */
export interface UATwoStateDiscreteSignalVariable_Base<T extends boolean>  extends UATwoStateDiscrete_Base<T> {
    actualValue?: UABaseDataVariable<boolean, DataType.Boolean>;
    simulationValue?: UABaseDataVariable<boolean, DataType.Boolean>;
    simulationState?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UATwoStateDiscreteSignalVariable<T extends boolean> extends UATwoStateDiscrete<T>, UATwoStateDiscreteSignalVariable_Base<T> {
}