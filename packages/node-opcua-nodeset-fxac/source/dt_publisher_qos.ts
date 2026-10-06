import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { DTTransmitQos } from "node-opcua-nodeset-ua/dist/dt_transmit_qos.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/AC/                          |
 * | nodeClass |DataType                                                    |
 * | name      |PublisherQosDataType                                        |
 * | isAbstract|false                                                       |
 */
export interface DTPublisherQos extends DTStructure {
  qosCategory: UAString; // String ns=0;i=12
  datagramQos?: DTTransmitQos[]; // ExtensionObject ns=0;i=23604
}
export interface UDTPublisherQos extends ExtensionObject, DTPublisherQos {};