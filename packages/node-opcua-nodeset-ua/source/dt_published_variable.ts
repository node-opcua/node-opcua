// ----- this file has been automatically generated - do not edit
import { QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PublishedVariableDataType                         |
 * | isAbstract|false                                             |
 */
export interface DTPublishedVariable extends DTStructure  {
  publishedVariable: NodeId; // NodeId ns=0;i=17
  attributeId: UInt32; // UInt32 ns=0;i=288
  samplingIntervalHint: number; // Double ns=0;i=290
  deadbandType: UInt32; // UInt32 ns=0;i=7
  deadbandValue: number; // Double ns=0;i=11
  indexRange: UAString; // String ns=0;i=291
  substituteValue: undefined; // Null ns=0;i=0
  metaDataProperties: QualifiedName[]; // QualifiedName ns=0;i=20
}