// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, Int32, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |Argument                                          |
 * | isAbstract|false                                             |
 */
export interface DTArgument extends DTStructure  {
  name: UAString; // String ns=0;i=12
  dataType: NodeId; // NodeId ns=0;i=17
  valueRank: Int32; // Int32 ns=0;i=6
  arrayDimensions: UInt32[]; // UInt32 ns=0;i=7
  description: LocalizedText; // LocalizedText ns=0;i=21
}