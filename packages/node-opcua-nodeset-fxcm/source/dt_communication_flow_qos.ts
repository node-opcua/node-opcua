import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTReceiveQos } from "node-opcua-nodeset-ua/dist/dt_receive_qos.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { DTTransmitQos } from "node-opcua-nodeset-ua/dist/dt_transmit_qos.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |CommunicationFlowQosDataType                                |
 * | isAbstract|false                                                       |
 */
export interface DTCommunicationFlowQos extends DTStructure {
  qosCategory: UAString; // String ns=0;i=12
  transmitQos?: DTTransmitQos[]; // ExtensionObject ns=0;i=23604
  receiveQos?: DTReceiveQos[]; // ExtensionObject ns=0;i=23608
}
export interface UDTCommunicationFlowQos extends ExtensionObject, DTCommunicationFlowQos {};