// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { DTEnumValue } from "node-opcua-nodeset-ua/source/dt_enum_value"
import { UASignal, UASignal_Base } from "./ua_signal"
import { UATwoStateDiscreteControlVariable } from "./ua_two_state_discrete_control_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |TwoStateDiscreteControlSignalType i=1223                    |
 * |isAbstract      |false                                                       |
 */
export interface UATwoStateDiscreteControlSignal_Base extends UASignal_Base {
    controlSignal: UATwoStateDiscreteControlVariable<(boolean | boolean[])>;
}
export interface UATwoStateDiscreteControlSignal extends UASignal, UATwoStateDiscreteControlSignal_Base {
}