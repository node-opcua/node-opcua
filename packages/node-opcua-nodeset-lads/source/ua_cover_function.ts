import type { LocalizedText } from "node-opcua-data-model";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UAFiniteStateVariable } from "node-opcua-nodeset-ua/dist/ua_finite_state_variable";

import type { UACoverStateMachine } from "./ua_cover_state_machine";
import type { UAFunction, UAFunction_Base } from "./ua_function";

// ----- this file has been automatically generated - do not edit

export interface UACoverFunction_operational extends UAFunctionalGroup { // Object
      currentState: UAFiniteStateVariable<LocalizedText>;
}
/**
 * The CoverFunctionType is used to control the
 * cover, door, or lid of a Laboratory Device.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CoverFunctionType i=1011                                    |
 * |isAbstract      |false                                                       |
 */
export interface UACoverFunction_Base extends UAFunction_Base {
    /**
     * operational
     * Operational organizes the methods and current
     * state of the cover function.
     */
    operational: UACoverFunction_operational;
    /**
     * coverState
     * he CoverStateMachineType is used to control the
     * lid, door, or cover of a laboratory device. One
     * Device may have any arbitrary number of lids,
     * doors, covers and their corresponding
     * CoverFunction.
     */
    coverState: UACoverStateMachine;
}
export interface UACoverFunction extends UAFunction, UACoverFunction_Base {}