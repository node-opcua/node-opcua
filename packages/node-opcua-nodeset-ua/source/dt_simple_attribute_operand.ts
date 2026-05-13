import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { QualifiedName } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTFilterOperand } from "./dt_filter_operand";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |SimpleAttributeOperand                                      |
 * | isAbstract|false                                                       |
 */
export interface DTSimpleAttributeOperand extends DTFilterOperand {
  typeDefinitionId: NodeId; // NodeId ns=0;i=17
  browsePath: QualifiedName[]; // QualifiedName ns=0;i=20
  attributeId: UInt32; // UInt32 ns=0;i=288
  indexRange: UAString; // String ns=0;i=291
}
export interface UDTSimpleAttributeOperand extends ExtensionObject, DTSimpleAttributeOperand {};