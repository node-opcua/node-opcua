import type { UInt32 } from "node-opcua-basic-types";

import type { UAMultiStateDiscreteControlVariable } from "./ua_multi_state_discrete_control_variable";
import type { UASignal, UASignal_Base } from "./ua_signal";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MultiStateDiscreteControlSignalType i=1239                  |
 * |isAbstract      |false                                                       |
 */
export interface UAMultiStateDiscreteControlSignal_Base extends UASignal_Base {
    controlSignal: UAMultiStateDiscreteControlVariable<UInt32>;
}
export interface UAMultiStateDiscreteControlSignal extends UASignal, UAMultiStateDiscreteControlSignal_Base {}