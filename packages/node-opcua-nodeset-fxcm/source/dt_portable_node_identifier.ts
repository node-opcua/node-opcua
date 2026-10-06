import type { UAString } from "node-opcua-basic-types";
import type { DTPortableNodeId } from "node-opcua-nodeset-ua/dist/dt_portable_node_id.js";
import type { DTUnion } from "node-opcua-nodeset-ua/dist/dt_union.js";

import type { DTPortableRelativePath } from "./dt_portable_relative_path.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |PortableNodeIdentifier                                      |
 * | isAbstract|false                                                       |
 */
export interface DTPortableNodeIdentifier_0 extends DTUnion {
  node: DTPortableNodeId; // ExtensionObject ns=0;i=24106
  alias?: never
  identifierBrowsePath?: never
}
export interface DTPortableNodeIdentifier_1 extends DTUnion {
  node?: never
  alias: UAString; // String ns=0;i=12
  identifierBrowsePath?: never
}
export interface DTPortableNodeIdentifier_2 extends DTUnion {
  node?: never
  alias?: never
  identifierBrowsePath: DTPortableRelativePath; // ExtensionObject ns=35;i=1047
}
export type DTPortableNodeIdentifier = 
  | DTPortableNodeIdentifier_0
  | DTPortableNodeIdentifier_1
  | DTPortableNodeIdentifier_2
  ;