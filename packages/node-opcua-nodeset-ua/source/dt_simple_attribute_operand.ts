// ----- this file has been automatically generated - do not edit
import { QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTFilterOperand } from "./dt_filter_operand"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |SimpleAttributeOperand                            |
 * | isAbstract|false                                             |
 */
export interface DTSimpleAttributeOperand extends DTFilterOperand  {
  typeDefinitionId: NodeId; // NodeId ns=0;i=17
  browsePath: QualifiedName[]; // QualifiedName ns=0;i=20
  attributeId: UInt32; // UInt32 ns=0;i=288
  indexRange: UAString; // String ns=0;i=291
}