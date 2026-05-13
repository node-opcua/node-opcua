import type { UAMethod } from "node-opcua-address-space-base";

import type { UAFile, UAFile_Base } from "./ua_file";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubConfigurationType i=25482                             |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubConfiguration_Base extends UAFile_Base {
    reserveIds: UAMethod;
    closeAndUpdate: UAMethod;
}
export interface UAPubSubConfiguration extends UAFile, UAPubSubConfiguration_Base {}