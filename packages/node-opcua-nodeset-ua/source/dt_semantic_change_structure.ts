// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |SemanticChangeStructureDataType                   |
 * | isAbstract|false                                             |
 */
export interface DTSemanticChangeStructure extends DTStructure  {
  affected: NodeId; // NodeId ns=0;i=17
  affectedType: NodeId; // NodeId ns=0;i=17
}