import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTHistoryEventFieldList } from "./dt_history_event_field_list";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |HistoryEvent                                                |
 * | isAbstract|false                                                       |
 */
export interface DTHistoryEvent extends DTStructure {
  events: DTHistoryEventFieldList[]; // ExtensionObject ns=0;i=920
}
export interface UDTHistoryEvent extends ExtensionObject, DTHistoryEvent {};