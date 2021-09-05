// ----- this file has been automatically generated - do not edit
import { QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |RelativePathElement                               |
 * | isAbstract|false                                             |
 */
export interface DTRelativePathElement extends DTStructure  {
  referenceTypeId: NodeId; // NodeId ns=0;i=17
  isInverse: boolean; // Boolean ns=0;i=1
  includeSubtypes: boolean; // Boolean ns=0;i=1
  targetName: QualifiedName; // QualifiedName ns=0;i=20
}