import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ToolListType i=44                                           |
 * |isAbstract      |false                                                       |
 */
export interface UAToolList_Base {
   // PlaceHolder for $Tool$
    nodeVersion?: UAProperty<UAString, DataType.String>;
}
export interface UAToolList extends UAObject, UAToolList_Base {}