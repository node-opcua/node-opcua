import type { UAProcessValue, UAProcessValue_Base } from "node-opcua-nodeset-machinery-process-values/dist/ua_process_value";

import type { DTCyclicProcessValue } from "./dt_cyclic_process_value";
import type { UACyclicProcessValueVariable } from "./ua_cyclic_process_value_variable";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MetalForming/                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CyclicProcessValueType i=1007                               |
 * |isAbstract      |false                                                       |
 */
export interface UACyclicProcessValue_Base extends UAProcessValue_Base {
    cyclicProcessValue: UACyclicProcessValueVariable<DTCyclicProcessValue>;
}
export interface UACyclicProcessValue extends UAProcessValue, UACyclicProcessValue_Base {}