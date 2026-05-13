import type { UAMethod } from "node-opcua-address-space-base";

import type { UAFolder, UAFolder_Base } from "./ua_folder";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |KeyCredentialConfigurationFolderType i=17496                |
 * |isAbstract      |false                                                       |
 */
export interface UAKeyCredentialConfigurationFolder_Base extends UAFolder_Base {
   // PlaceHolder for $ServiceName$
    createCredential?: UAMethod;
}
export interface UAKeyCredentialConfigurationFolder extends UAFolder, UAKeyCredentialConfigurationFolder_Base {}