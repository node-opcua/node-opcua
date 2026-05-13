import type { UASignal, UASignal_Base } from "./ua_signal";
import type { UATwoStateDiscreteControlVariable } from "./ua_two_state_discrete_control_variable";

// ----- this file has been automatically generated - do not edit

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
export interface UATwoStateDiscreteControlSignal extends UASignal, UATwoStateDiscreteControlSignal_Base {}