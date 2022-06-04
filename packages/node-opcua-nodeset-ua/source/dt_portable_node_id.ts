// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PortableNodeId                                    |
 * | isAbstract|false                                             |
 */
export interface DTPortableNodeId extends DTStructure  {
  namespaceUri: UAString; // String ns=0;i=12
  identifier: NodeId; // NodeId ns=0;i=17
}