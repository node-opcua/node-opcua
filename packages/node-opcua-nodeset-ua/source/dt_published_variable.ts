import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { QualifiedName } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { Variant } from "node-opcua-variant";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PublishedVariableDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTPublishedVariable extends DTStructure {
  publishedVariable: NodeId; // NodeId ns=0;i=17
  attributeId: UInt32; // UInt32 ns=0;i=288
  samplingIntervalHint: number; // Double ns=0;i=290
  deadbandType: UInt32; // UInt32 ns=0;i=7
  deadbandValue: number; // Double ns=0;i=11
  indexRange: UAString; // String ns=0;i=291
  substituteValue: Variant; // Variant ns=0;i=24
  metaDataProperties: QualifiedName[]; // QualifiedName ns=0;i=20
}
export interface UDTPublishedVariable extends ExtensionObject, DTPublishedVariable {};