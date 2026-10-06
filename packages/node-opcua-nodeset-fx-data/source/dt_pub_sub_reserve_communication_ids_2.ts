import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTPubSubReserveCommunicationIds } from "./dt_pub_sub_reserve_communication_ids.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/Data/                        |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubReserveCommunicationIds2DataType                      |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubReserveCommunicationIds2 extends DTPubSubReserveCommunicationIds {
  transportProfileUri: UAString; // String ns=0;i=12
  numReqWriterGroupIds: UInt16; // UInt16 ns=0;i=5
  numReqDataSetWriterIds: UInt16; // UInt16 ns=0;i=5
  requestTransportSpecificInfo: boolean; // Boolean ns=0;i=1
}
export interface UDTPubSubReserveCommunicationIds2 extends ExtensionObject, DTPubSubReserveCommunicationIds2 {};