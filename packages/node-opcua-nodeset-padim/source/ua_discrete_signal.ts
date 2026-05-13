import type { UADiscreteSignalVariable } from "./ua_discrete_signal_variable";
import type { UASignal, UASignal_Base } from "./ua_signal";

// ----- this file has been automatically generated - do not edit

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
export interface UADiscreteSignal extends UASignal, UADiscreteSignal_Base {}