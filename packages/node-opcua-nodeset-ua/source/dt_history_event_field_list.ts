// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |HistoryEventFieldList                             |
 * | isAbstract|false                                             |
 */
export interface DTHistoryEventFieldList extends DTStructure {
  eventFields: VariantOptions[]; // Variant ns=0;i=0
}
export interface UDTHistoryEventFieldList extends ExtensionObject, DTHistoryEventFieldList {};