import type { UAString } from "node-opcua-basic-types";
import type { DTPubSubConfiguration2 } from "node-opcua-nodeset-ua/dist/dt_pub_sub_configuration_2.js";
import type { DTPubSubConfigurationRef } from "node-opcua-nodeset-ua/dist/dt_pub_sub_configuration_ref.js";
import type { DTPubSubConfigurationValue } from "node-opcua-nodeset-ua/dist/dt_pub_sub_configuration_value.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { DataType } from "node-opcua-variant";

import type { DTNodeIdTranslation } from "./dt_node_id_translation.js";
import type { UACommunicationModelConfiguration, UACommunicationModelConfiguration_Base } from "./ua_communication_model_configuration.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubCommunicationModelConfigurationType i=1042            |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubCommunicationModelConfiguration_Base extends UACommunicationModelConfiguration_Base {
    configurationReferences: UABaseDataVariable<DTPubSubConfigurationRef[], DataType.ExtensionObject>;
    configurationValues: UABaseDataVariable<DTPubSubConfigurationValue[], DataType.ExtensionObject>;
    namespaces: UABaseDataVariable<UAString[], DataType.String>;
    pubSubConfiguration: UABaseDataVariable<DTPubSubConfiguration2, DataType.ExtensionObject>;
    translationTable: UABaseDataVariable<DTNodeIdTranslation[], DataType.ExtensionObject>;
}
export interface UAPubSubCommunicationModelConfiguration extends UACommunicationModelConfiguration, UAPubSubCommunicationModelConfiguration_Base {}