// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTTransmitQos } from "./dt_transmit_qos"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |TransmitQosPriorityDataType                       |
 * | isAbstract|false                                             |
 */
export interface DTTransmitQosPriority extends DTTransmitQos  {
  priorityLabel: UAString; // String ns=0;i=12
}