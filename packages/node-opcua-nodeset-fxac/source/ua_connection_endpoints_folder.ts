import type { UInt16 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionEndpointsFolderType i=20                          |
 * |isAbstract      |false                                                       |
 */
export interface UAConnectionEndpointsFolder_Base extends UAFolder_Base {
   // PlaceHolder for $ConnectionEndpoint$
    commHealth?: UABaseDataVariable<UInt16, DataType.UInt16>;
}
export interface UAConnectionEndpointsFolder extends UAFolder, UAConnectionEndpointsFolder_Base {}