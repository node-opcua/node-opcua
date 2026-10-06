import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FunctionalEntityCapabilitiesType i=1008                     |
 * |isAbstract      |false                                                       |
 */
export interface UAFunctionalEntityCapabilities_Base extends UAFolder_Base {
   // PlaceHolder for $Capability$
    feedbackSignalRequired?: UABaseDataVariable<boolean, DataType.Boolean>;
}
export interface UAFunctionalEntityCapabilities extends UAFolder, UAFunctionalEntityCapabilities_Base {}