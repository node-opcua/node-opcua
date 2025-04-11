// ----- this file has been automatically generated - do not edit
import { UASignal, UASignal_Base } from "./ua_signal"
import { UADiscreteSignalVariable } from "./ua_discrete_signal_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |DiscreteSignalType i=1036                                   |
 * |isAbstract      |false                                                       |
 */
export interface UADiscreteSignal_Base extends UASignal_Base {
    discreteSignal: UADiscreteSignalVariable<any, any>;
}
export interface UADiscreteSignal extends UASignal, UADiscreteSignal_Base {
}