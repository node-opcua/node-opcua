import type { UAMethod } from "node-opcua-address-space-base";
import type { UAFile, UAFile_Base } from "node-opcua-nodeset-ua/dist/ua_file.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionManagerConfigurationType i=1011                   |
 * |isAbstract      |false                                                       |
 */
export interface UAConnectionManagerConfiguration_Base extends UAFile_Base {
    closeAndUpdate: UAMethod;
}
export interface UAConnectionManagerConfiguration extends UAFile, UAConnectionManagerConfiguration_Base {}