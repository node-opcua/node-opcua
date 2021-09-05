// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTFilterOperand } from "./dt_filter_operand"
import { DTRelativePath } from "./dt_relative_path"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |AttributeOperand                                  |
 * | isAbstract|false                                             |
 */
export interface DTAttributeOperand extends DTFilterOperand  {
  nodeId: NodeId; // NodeId ns=0;i=17
  alias: UAString; // String ns=0;i=12
  browsePath: DTRelativePath; // ExtensionObject ns=0;i=540
  attributeId: UInt32; // UInt32 ns=0;i=288
  indexRange: UAString; // String ns=0;i=291
}