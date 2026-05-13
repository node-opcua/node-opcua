import type { UAMethod } from "node-opcua-address-space-base";

import type { UAControlVariable } from "./ua_control_variable";
import type { UASignal, UASignal_Base } from "./ua_signal";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ControlSignalType i=1023                                    |
 * |isAbstract      |false                                                       |
 */
export interface UAControlSignal_Base extends UASignal_Base {
    autoAdjustPositioner?: UAMethod;
    controlSignal: UAControlVariable<(number | number[])>;
}
export interface UAControlSignal extends UASignal, UAControlSignal_Base {}