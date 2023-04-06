// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UASignal, UASignal_Base } from "./ua_signal"
import { UATwoStateDiscreteSignalVariable } from "./ua_two_state_discrete_signal_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |20:TwoStateDiscreteSignalType ns=20;i=1037        |
 * |isAbstract      |false                                             |
 */
export interface UATwoStateDiscreteSignal_Base extends UASignal_Base {
    twoStateDiscreteSignal: UATwoStateDiscreteSignalVariable<boolean>;
}
export interface UATwoStateDiscreteSignal extends UASignal, UATwoStateDiscreteSignal_Base {
}