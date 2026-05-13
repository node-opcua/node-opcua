import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTFilterOperand } from "./dt_filter_operand";
import type { DTRelativePath } from "./dt_relative_path";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |AttributeOperand                                            |
 * | isAbstract|false                                                       |
 */
export interface DTAttributeOperand extends DTFilterOperand {
  nodeId: NodeId; // NodeId ns=0;i=17
  alias: UAString; // String ns=0;i=12
  browsePath: DTRelativePath; // ExtensionObject ns=0;i=540
  attributeId: UInt32; // UInt32 ns=0;i=288
  indexRange: UAString; // String ns=0;i=291
}
export interface UDTAttributeOperand extends ExtensionObject, DTAttributeOperand {};