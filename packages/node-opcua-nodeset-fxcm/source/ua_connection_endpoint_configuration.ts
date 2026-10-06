import type { UAObject } from "node-opcua-address-space-base";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UASelectionList } from "node-opcua-nodeset-ua/dist/ua_selection_list.js";
import type { DataType } from "node-opcua-variant";

import type { DTPortableNodeIdentifier } from "./dt_portable_node_identifier.js";
import type { DTPortableNodeIdentifierValuePair } from "./dt_portable_node_identifier_value_pair.js";
import type { UAConnectionEndpointParameter } from "./ua_connection_endpoint_parameter.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionEndpointConfigurationType i=1129                  |
 * |isAbstract      |false                                                       |
 */
export interface UAConnectionEndpointConfiguration_Base {
    configurationData?: UABaseDataVariable<DTPortableNodeIdentifierValuePair[], DataType.ExtensionObject>;
    connectionEndpoint: UAConnectionEndpointParameter;
    controlGroups?: UABaseDataVariable<DTPortableNodeIdentifier[], DataType.ExtensionObject>;
    expectedVerificationVariables?: UABaseDataVariable<DTPortableNodeIdentifierValuePair[], DataType.ExtensionObject>;
    functionalEntityNode: UASelectionList<DTPortableNodeIdentifier, DataType.ExtensionObject>;
}
export interface UAConnectionEndpointConfiguration extends UAObject, UAConnectionEndpointConfiguration_Base {}