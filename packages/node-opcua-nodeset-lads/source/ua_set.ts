import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * The SetType provides an unordered set of objects.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/LADS/                           |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SetType i=61                                                |
 * |isAbstract      |true                                                        |
 */
export interface UASet_Base extends UAFolder_Base {
    /**
     * nodeVersion
     * NodeVersion and the GeneralModelChangeEventType
     * are mechanisms to notify clients that the content
     * of the set has changed and shall be used as
     * defined in OPC 10000-3.
     */
    nodeVersion?: UAProperty<UAString, DataType.String>;
   // PlaceHolder for $SetElement$
}
export interface UASet extends UAFolder, UASet_Base {}