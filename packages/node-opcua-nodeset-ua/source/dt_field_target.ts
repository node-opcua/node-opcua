// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString, Guid } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { EnumOverrideValueHandling } from "./enum_override_value_handling"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |FieldTargetDataType                               |
 * | isAbstract|false                                             |
 */
export interface DTFieldTarget extends DTStructure  {
  dataSetFieldId: Guid; // Guid ns=0;i=14
  receiverIndexRange: UAString; // String ns=0;i=291
  targetNodeId: NodeId; // NodeId ns=0;i=17
  attributeId: UInt32; // UInt32 ns=0;i=288
  writeIndexRange: UAString; // String ns=0;i=291
  overrideValueHandling: EnumOverrideValueHandling; // Int32 ns=0;i=15874
  overrideValue: undefined; // Null ns=0;i=0
}