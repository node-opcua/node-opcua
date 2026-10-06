import type { UAObject } from "node-opcua-address-space-base";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UASelectionList } from "node-opcua-nodeset-ua/dist/ua_selection_list.js";
import type { DataType } from "node-opcua-variant";

import type { DTPortableNodeIdentifier } from "./dt_portable_node_identifier.js";
import type { UACommunicationModelConfiguration } from "./ua_communication_model_configuration.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutomationComponentConfigurationType i=1246                 |
 * |isAbstract      |false                                                       |
 */
export interface UAAutomationComponentConfiguration_Base {
   // PlaceHolder for $AssetVerification$
    automationComponentNode: UASelectionList<DTPortableNodeIdentifier, DataType.ExtensionObject>;
    commandBundleRequired: UABaseDataVariable<boolean, DataType.Boolean>;
    communicationModelConfig?: UACommunicationModelConfiguration;
}
export interface UAAutomationComponentConfiguration extends UAObject, UAAutomationComponentConfiguration_Base {}