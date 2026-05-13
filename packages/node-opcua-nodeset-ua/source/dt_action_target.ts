import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ActionTargetDataType                                        |
 * | isAbstract|false                                                       |
 */
export interface DTActionTarget extends DTStructure {
  actionTargetId: UInt16; // UInt16 ns=0;i=5
  name: UAString; // String ns=0;i=12
  description: LocalizedText; // LocalizedText ns=0;i=21
}
export interface UDTActionTarget extends ExtensionObject, DTActionTarget {};