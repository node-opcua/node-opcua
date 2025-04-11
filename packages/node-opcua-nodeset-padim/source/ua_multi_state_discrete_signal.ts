// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { UASignal, UASignal_Base } from "./ua_signal"
import { UAMultiStateDiscreteSignalVariable } from "./ua_multi_state_discrete_signal_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MultiStateDiscreteSignalType i=1038                         |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiStateDiscreteSignal_Base extends UASignal_Base {
    multiStateDiscreteSignal: UAMultiStateDiscreteSignalVariable<UInt32>;
}
export interface UAMultiStateDiscreteSignal extends UASignal, UAMultiStateDiscreteSignal_Base {
}