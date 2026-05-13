import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTTransmitQos } from "./dt_transmit_qos";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |TransmitQosPriorityDataType                                 |
 * | isAbstract|false                                                       |
 */
export interface DTTransmitQosPriority extends DTTransmitQos {
  priorityLabel: UAString; // String ns=0;i=12
}
export interface UDTTransmitQosPriority extends ExtensionObject, DTTransmitQosPriority {};