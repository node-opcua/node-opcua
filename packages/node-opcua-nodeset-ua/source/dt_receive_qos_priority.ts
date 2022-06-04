// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTReceiveQos } from "./dt_receive_qos"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |ReceiveQosPriorityDataType                        |
 * | isAbstract|false                                             |
 */
export interface DTReceiveQosPriority extends DTReceiveQos  {
  priorityLabel: UAString; // String ns=0;i=12
}