import type { UInt32 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionManagerCapabilitiesType i=1010                    |
 * |isAbstract      |false                                                       |
 */
export interface UAConnectionManagerCapabilities_Base extends UAFolder_Base {
   // PlaceHolder for $Capability$
    maxConnectionConfigurationSets?: UABaseDataVariable<UInt32, DataType.UInt32>;
    monitorsAllConnectionEndpoints?: UABaseDataVariable<boolean, DataType.Boolean>;
    monitorsLocalConnectionEndpoints?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAConnectionManagerCapabilities extends UAFolder, UAConnectionManagerCapabilities_Base {}