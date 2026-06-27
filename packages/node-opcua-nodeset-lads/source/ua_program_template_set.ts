import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UASet, UASet_Base } from "./ua_set";

// ----- this file has been automatically generated - do not edit

/**
 * The ProgramTemplateSetType is used for organising
 * ProgramTemplateType objects in an unordered list
 * structure.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProgramTemplateSetType i=1019                               |
 * |isAbstract      |false                                                       |
 */
export interface UAProgramTemplateSet_Base extends UASet_Base {
   // PlaceHolder for $SetElement$
    /**
     * nodeVersion
     * NodeVersion and the GeneralModelChangeEventType
     * are mechanisms to notify clients that the content
     * of the set has changed and shall be used as
     * defined in OPC 10000-3.
     */
    nodeVersion: UAProperty<UAString, DataType.String>;
}
export interface UAProgramTemplateSet extends Omit<UASet, "$SetElement$"|"nodeVersion">, UAProgramTemplateSet_Base {}