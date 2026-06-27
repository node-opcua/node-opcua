import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UATopologyElement, UATopologyElement_Base } from "node-opcua-nodeset-di/dist/ua_topology_element";
import type { DataType } from "node-opcua-variant";

import type { UAActiveProgram } from "./ua_active_program";
import type { UAProgramTemplateSet } from "./ua_program_template_set";
import type { UAResultSet } from "./ua_result_set";

// ----- this file has been automatically generated - do not edit

export interface UAProgramManager_resultSet extends Omit<UAResultSet, "nodeVersion"> { // Object
      /**
       * nodeVersion
       * NodeVersion and the GeneralModelChangeEventType
       * are mechanisms to notify clients that the content
       * of the set has changed and shall be used as
       * defined in OPC 10000-3.
       */
      nodeVersion: UAProperty<UAString, DataType.String>;
}
/**
 * The ProgramManager provides the functional unit's
 * program manager.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProgramManagerType i=1006                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAProgramManager_Base extends UATopologyElement_Base {
    /**
     * activeProgram
     * The ActiveProgram specifies the current state of
     * operation of a FunctionalUnit. It provides
     * context and information about the currently
     * active program on the device. This allows users
     * to follow the progress of a program run in a
     * standardized fashion by organising steps into a
     * flat, linear sequence.
     */
    activeProgram: UAActiveProgram;
    /**
     * programTemplateSet
     * The ProgramTemplateSetType is used for organising
     * ProgramTemplateType objects in an unordered list
     * structure.
     */
    programTemplateSet: UAProgramTemplateSet;
    download?: UAMethod;
    remove?: UAMethod;
    upload?: UAMethod;
    /**
     * resultSet
     * The ResultSetType is used for organising
     * ResultType objects in an unordered list structure.
     */
    resultSet: UAProgramManager_resultSet;
}
export interface UAProgramManager extends UATopologyElement, UAProgramManager_Base {}