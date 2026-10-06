import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTCommunicationLinkConfiguration } from "./dt_communication_link_configuration.js";
import type { DTConnectionEndpointDefinition } from "./dt_connection_endpoint_definition.js";
import type { DTNodeIdValuePair } from "./dt_node_id_value_pair.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |ConnectionEndpointConfigurationDataType                     |
 * | isAbstract|false                                                       |
 */
export interface DTConnectionEndpointConfiguration extends DTStructure {
  functionalEntityNode: NodeId; // NodeId ns=0;i=17
  connectionEndpoint: DTConnectionEndpointDefinition; // ExtensionObject ns=33;i=3011
  expectedVerificationVariables: DTNodeIdValuePair[]; // ExtensionObject ns=33;i=1028
  controlGroups: NodeId[]; // NodeId ns=0;i=17
  configurationData: DTNodeIdValuePair[]; // ExtensionObject ns=33;i=1028
  communicationLinks?: DTCommunicationLinkConfiguration; // ExtensionObject ns=33;i=3007
}
export interface UDTConnectionEndpointConfiguration extends ExtensionObject, DTConnectionEndpointConfiguration {};