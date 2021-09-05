// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { Byte } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |ModelChangeStructureDataType                      |
 * | isAbstract|false                                             |
 */
export interface DTModelChangeStructure extends DTStructure  {
  affected: NodeId; // NodeId ns=0;i=17
  affectedType: NodeId; // NodeId ns=0;i=17
  verb: Byte; // Byte ns=0;i=3
}