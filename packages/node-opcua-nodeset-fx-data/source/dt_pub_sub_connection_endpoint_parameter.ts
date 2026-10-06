import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTConnectionEndpointParameter } from "./dt_connection_endpoint_parameter.js";
import type { DTRelatedEndpoint } from "./dt_related_endpoint.js";
import type { EnumPubSubConnectionEndpointModeEnum } from "./enum_pub_sub_connection_endpoint_mode_enum.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubConnectionEndpointParameterDataType                   |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubConnectionEndpointParameter extends DTConnectionEndpointParameter {
  name: UAString; // String ns=0;i=12
  connectionEndpointTypeId: NodeId; // NodeId ns=0;i=17
  inputVariableIds: NodeId[]; // NodeId ns=0;i=17
  outputVariableIds: NodeId[]; // NodeId ns=0;i=17
  isPersistent: boolean; // Boolean ns=0;i=1
  cleanupTimeout: number; // Double ns=0;i=290
  relatedEndpoint: DTRelatedEndpoint; // ExtensionObject ns=33;i=3003
  isPreconfigured: boolean; // Boolean ns=0;i=1
  mode: EnumPubSubConnectionEndpointModeEnum; // Int32 ns=33;i=31
}
export interface UDTPubSubConnectionEndpointParameter extends ExtensionObject, DTPubSubConnectionEndpointParameter {};