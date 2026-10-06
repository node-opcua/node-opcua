import type { UInt16 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { StatusCode } from "node-opcua-status-code";
import type { VariantOptions } from "node-opcua-variant";

import type { DTReserveCommunicationIdsResult } from "./dt_reserve_communication_ids_result.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubReserveCommunicationIdsResultDataType                 |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubReserveCommunicationIdsResult extends DTReserveCommunicationIdsResult {
  result: StatusCode; // StatusCode ns=0;i=19
  defaultPublisherId: VariantOptions; // Variant ns=0;i=24
  writerGroupIds: UInt16[]; // UInt16 ns=0;i=5
  dataSetWriterIds: UInt16[]; // UInt16 ns=0;i=5
}
export interface UDTPubSubReserveCommunicationIdsResult extends ExtensionObject, DTPubSubReserveCommunicationIdsResult {};