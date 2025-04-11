// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UATwoStateDiscrete, UATwoStateDiscrete_Base } from "node-opcua-nodeset-ua/dist/ua_two_state_discrete"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |TwoStateDiscreteSignalVariableType i=1141                   |
 * |dataType        |Boolean                                                     |
 * |dataType Name   |(boolean | boolean[]) i=1                                   |
 * |value rank      |-2                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UATwoStateDiscreteSignalVariable_Base<T extends (boolean | boolean[])>  extends UATwoStateDiscrete_Base<T> {
    actualValue?: UABaseDataVariable<(boolean | boolean[]), DataType.Boolean>;
    simulationValue?: UABaseDataVariable<(boolean | boolean[]), DataType.Boolean>;
    simulationState?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UATwoStateDiscreteSignalVariable<T extends (boolean | boolean[])> extends UATwoStateDiscrete<T>, UATwoStateDiscreteSignalVariable_Base<T> {
}