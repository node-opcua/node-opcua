import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UALockingServices } from "node-opcua-nodeset-di/dist/ua_locking_services";
import type { UATopologyElement, UATopologyElement_Base } from "node-opcua-nodeset-di/dist/ua_topology_element";
import type { DataType } from "node-opcua-variant";

import type { UAFunctionSet } from "./ua_function_set";
import type { UAFunctionalUnitStateMachine } from "./ua_functional_unit_state_machine";
import type { UAProgramManager } from "./ua_program_manager";
import type { UASupportedPropertiesSet } from "./ua_supported_properties_set";

// ----- this file has been automatically generated - do not edit

export interface UAFunctionalUnit_identification extends UAFunctionalGroup { // Object
      /**
       * assetId
       * AssetId is a user-writable alphanumeric character
       * sequence the uniquely identifies a FunctionalUnit
       * (see OPC UA 10000-100).
       */
      assetId?: UAProperty<UAString, DataType.String>;
      /**
       * componentName
       * ComponentName is a user-writable name provided by
       * the integrator or user of the FunctionalUnit.
       */
      componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAFunctionalUnit_operational extends UAFunctionalGroup { // Object
      clear?: UAMethod;
      stop?: UAMethod;
      abort?: UAMethod;
      effectiveDisplayName?: UAProperty<LocalizedText, DataType.LocalizedText>;
      startProgram?: UAMethod;
}
/**
 * The FunctionalUnitType represents a functional
 * unit of a laboratory or analytical device.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FunctionalUnitType i=1003                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAFunctionalUnit_Base extends UATopologyElement_Base {
    /**
     * functionSet
     * The FunctionSetType is used for organising
     * FunctionType objects in an unordered list
     * structure.
     */
    functionSet?: UAFunctionSet;
    /**
     * identification
     * Used to organize parameters for identification of
     * this functional unit.
     */
    identification?: UAFunctionalUnit_identification;
    /**
     * lock
     * Used to lock the FunctionalUnit.
     */
    lock: UALockingServices;
    /**
     * programManager
     * The ProgramManager provides the functional unit's
     * program manager.
     */
    programManager?: UAProgramManager;
    /**
     * supportedPropertiesSet
     * SupportedPropertiesSet provides a set of
     * properties which are supported as members of a
     * properties list Argument for Method calls such
     * as, FunctionalUnit.StartFunctions() or
     * ActiveProgram.Start().
     */
    supportedPropertiesSet?: UASupportedPropertiesSet;
    /**
     * functionalUnitState
     * FunctionalUnitState provides the state-machine of
     * the FunctionalUnit.
     */
    functionalUnitState: UAFunctionalUnitStateMachine;
    /**
     * assetId
     * AssetId is a user-writable alphanumeric character
     * sequence the uniquely identifies a FunctionalUnit
     * (see OPC UA 10000-100).
     */
    assetId?: UAProperty<UAString, DataType.String>;
    /**
     * componentName
     * ComponentName is a user-writable name provided by
     * the integrator or user of the FunctionalUnit.
     */
    componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * operational
     * Parameters and Methods useful for during normal
     * operation, like process data.
     */
    operational?: UAFunctionalUnit_operational;
}
export interface UAFunctionalUnit extends Omit<UATopologyElement, "identification"|"lock">, UAFunctionalUnit_Base {}