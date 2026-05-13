import type { ExtensionObject } from "node-opcua-extension-object";
import type { Variant } from "node-opcua-variant";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |HistoryEventFieldList                                       |
 * | isAbstract|false                                                       |
 */
export interface DTHistoryEventFieldList extends DTStructure {
  eventFields: Variant[]; // Variant ns=0;i=24
}
export interface UDTHistoryEventFieldList extends ExtensionObject, DTHistoryEventFieldList {};