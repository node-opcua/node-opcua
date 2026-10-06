import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTRelatedEndpoint } from "./dt_related_endpoint.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |ConnectionEndpointParameterDataType                         |
 * | isAbstract|true                                                        |
 */
export interface DTConnectionEndpointParameter extends DTStructure {
  name: UAString; // String ns=0;i=12
  connectionEndpointTypeId: NodeId; // NodeId ns=0;i=17
  inputVariableIds: NodeId[]; // NodeId ns=0;i=17
  outputVariableIds: NodeId[]; // NodeId ns=0;i=17
  isPersistent: boolean; // Boolean ns=0;i=1
  cleanupTimeout: number; // Double ns=0;i=290
  relatedEndpoint: DTRelatedEndpoint; // ExtensionObject ns=33;i=3003
  isPreconfigured: boolean; // Boolean ns=0;i=1
}
export interface UDTConnectionEndpointParameter extends ExtensionObject, DTConnectionEndpointParameter {};