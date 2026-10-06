import type { NodeId } from "node-opcua-nodeid";
import type { DTUnion } from "node-opcua-nodeset-ua/dist/dt_union.js";

import type { DTConnectionEndpointParameter } from "./dt_connection_endpoint_parameter.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |ConnectionEndpointDefinitionDataType                        |
 * | isAbstract|false                                                       |
 */
export interface DTConnectionEndpointDefinition_0 extends DTUnion {
  parameter?: DTConnectionEndpointParameter; // ExtensionObject ns=33;i=3009
  node?: never
}
export interface DTConnectionEndpointDefinition_1 extends DTUnion {
  parameter?: never
  node: NodeId; // NodeId ns=0;i=17
}
export type DTConnectionEndpointDefinition = 
  | DTConnectionEndpointDefinition_0
  | DTConnectionEndpointDefinition_1
  ;