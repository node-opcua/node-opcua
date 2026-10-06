import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTReceiveQos } from "node-opcua-nodeset-ua/dist/dt_receive_qos.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/AC/                          |
 * | nodeClass |DataType                                                    |
 * | name      |SubscriberQosDataType                                       |
 * | isAbstract|false                                                       |
 */
export interface DTSubscriberQos extends DTStructure {
  qosCategory: UAString; // String ns=0;i=12
  datagramQos?: DTReceiveQos[]; // ExtensionObject ns=0;i=23608
}
export interface UDTSubscriberQos extends ExtensionObject, DTSubscriberQos {};