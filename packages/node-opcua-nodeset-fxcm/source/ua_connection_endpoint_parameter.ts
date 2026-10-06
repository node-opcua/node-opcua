import type { UAObject } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DTCommunicationLinkConfiguration } from "node-opcua-nodeset-fx-data/dist/dt_communication_link_configuration.js";
import type { DTPortableNodeId } from "node-opcua-nodeset-ua/dist/dt_portable_node_id.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UASelectionList } from "node-opcua-nodeset-ua/dist/ua_selection_list.js";
import type { DataType } from "node-opcua-variant";

import type { DTPortableNodeIdentifier } from "./dt_portable_node_identifier.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionEndpointParameterType i=1261                      |
 * |isAbstract      |false                                                       |
 */
export interface UAConnectionEndpointParameter_Base {
    cleanupTimeout: UASelectionList<number, DataType.Double>;
    communicationLinks?: UABaseDataVariable<DTCommunicationLinkConfiguration, DataType.ExtensionObject>;
    connectionEndpointTypeId: UABaseDataVariable<DTPortableNodeId, DataType.ExtensionObject>;
    inputVariableIds?: UABaseDataVariable<DTPortableNodeIdentifier[], DataType.ExtensionObject>;
    isPersistent: UASelectionList<boolean, DataType.Boolean>;
    isPreconfigured: UABaseDataVariable<boolean, DataType.Boolean>;
    name: UASelectionList<UAString, DataType.String>;
    outputVariableIds?: UABaseDataVariable<DTPortableNodeIdentifier[], DataType.ExtensionObject>;
    preconfiguredPublishedDataSet?: UABaseDataVariable<UAString, DataType.String>;
    preconfiguredSubscribedDataSet?: UABaseDataVariable<UAString, DataType.String>;
}
export interface UAConnectionEndpointParameter extends UAObject, UAConnectionEndpointParameter_Base {}