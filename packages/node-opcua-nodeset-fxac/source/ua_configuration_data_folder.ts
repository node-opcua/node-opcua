import type { UAMethod } from "node-opcua-address-space-base";
import type { UAFunctionalGroup, UAFunctionalGroup_Base } from "node-opcua-nodeset-di/dist/ua_functional_group.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConfigurationDataFolderType i=1041                          |
 * |isAbstract      |false                                                       |
 */
export interface UAConfigurationDataFolder_Base extends UAFunctionalGroup_Base {
   // PlaceHolder for $ConfigurationVariable1$
    clearStoredVariables?: UAMethod;
    listStoredVariables?: UAMethod;
    setStoredVariables?: UAMethod;
   // PlaceHolder for $ConfigurationVariable$
}
export interface UAConfigurationDataFolder extends UAFunctionalGroup, UAConfigurationDataFolder_Base {}