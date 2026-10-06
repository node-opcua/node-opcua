import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTReserveCommunicationIds } from "./dt_reserve_communication_ids.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubReserveCommunicationIdsDataType                       |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubReserveCommunicationIds extends DTReserveCommunicationIds {
  transportProfileUri: UAString; // String ns=0;i=12
  numReqWriterGroupIds: UInt16; // UInt16 ns=0;i=5
  numReqDataSetWriterIds: UInt16; // UInt16 ns=0;i=5
}
export interface UDTPubSubReserveCommunicationIds extends ExtensionObject, DTPubSubReserveCommunicationIds {};