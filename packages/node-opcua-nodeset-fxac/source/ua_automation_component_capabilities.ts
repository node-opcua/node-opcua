import type { UInt32 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutomationComponentCapabilitiesType i=1001                  |
 * |isAbstract      |false                                                       |
 */
export interface UAAutomationComponentCapabilities_Base extends UAFolder_Base {
   // PlaceHolder for $Capability$
    commandBundleRequired?: UABaseDataVariable<boolean, DataType.Boolean>;
    maxConnections?: UABaseDataVariable<UInt32, DataType.UInt32>;
    maxConnectionsPerCall?: UABaseDataVariable<UInt32, DataType.UInt32>;
    maxFunctionalEntities?: UABaseDataVariable<UInt32, DataType.UInt32>;
    minConnections?: UABaseDataVariable<UInt32, DataType.UInt32>;
    supportsPersistence?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAAutomationComponentCapabilities extends UAFolder, UAAutomationComponentCapabilities_Base {}