import type { UAString } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { DTRelativePath } from "node-opcua-nodeset-ua/dist/dt_relative_path.js";
import type { DTUnion } from "node-opcua-nodeset-ua/dist/dt_union.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |NodeIdentifier                                              |
 * | isAbstract|false                                                       |
 */
export interface DTNodeIdentifier_0 extends DTUnion {
  node: NodeId; // NodeId ns=0;i=17
  alias?: never
  identifierBrowsePath?: never
}
export interface DTNodeIdentifier_1 extends DTUnion {
  node?: never
  alias: UAString; // String ns=0;i=12
  identifierBrowsePath?: never
}
export interface DTNodeIdentifier_2 extends DTUnion {
  node?: never
  alias?: never
  identifierBrowsePath: DTRelativePath; // ExtensionObject ns=0;i=540
}
export type DTNodeIdentifier = 
  | DTNodeIdentifier_0
  | DTNodeIdentifier_1
  | DTNodeIdentifier_2
  ;