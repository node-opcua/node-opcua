import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTHistoryEvent } from "./dt_history_event";
import type { DTHistoryEventFieldList } from "./dt_history_event_field_list";
import type { DTModificationInfo } from "./dt_modification_info";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |HistoryModifiedEvent                                        |
 * | isAbstract|false                                                       |
 */
export interface DTHistoryModifiedEvent extends DTHistoryEvent {
  events: DTHistoryEventFieldList[]; // ExtensionObject ns=0;i=920
  modificationInfos: DTModificationInfo[]; // ExtensionObject ns=0;i=11216
}
export interface UDTHistoryModifiedEvent extends ExtensionObject, DTHistoryModifiedEvent {};