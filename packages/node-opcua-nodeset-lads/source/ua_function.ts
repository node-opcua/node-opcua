import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { UATopologyElement, UATopologyElement_Base } from "node-opcua-nodeset-di/dist/ua_topology_element";
import type { DataType } from "node-opcua-variant";

import type { UAFunctionSet } from "./ua_function_set";

// ----- this file has been automatically generated - do not edit

export interface UAFunction_functionSet extends Omit<UAFunctionSet, "nodeVersion"> { // Object
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
 * Abstract function type
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FunctionType i=1004                                         |
 * |isAbstract      |true                                                        |
 */
export interface UAFunction_Base extends UATopologyElement_Base {
    /**
     * configuration
     * Configuration is used to organize parameters for
     * configuration of the Function.
     */
    configuration?: UAFunctionalGroup;
    /**
     * functionSet
     * The FunctionSetType is used for organising
     * FunctionType objects in an unordered list
     * structure.
     */
    functionSet?: UAFunction_functionSet;
    /**
     * isEnabled
     * IsEnabled indicates whether the Function can
     * currently be executed on the Device. A Function
     * may be disabled for several reasons including not
     * licensed, missing hardware modules, or missing
     * supplies
     */
    isEnabled: UAProperty<boolean, DataType.Boolean>;
}
export interface UAFunction extends UATopologyElement, UAFunction_Base {}