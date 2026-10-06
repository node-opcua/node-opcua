import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTReceiveQos } from "node-opcua-nodeset-ua/dist/dt_receive_qos.js";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";
import type { VariantOptions } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/CM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ReceiveQosSelectionDataType                                 |
 * | isAbstract|false                                                       |
 */
export interface DTReceiveQosSelection extends DTStructure {
  receiveQos?: DTReceiveQos[]; // ExtensionObject ns=0;i=23608
  receiveQosSelection: VariantOptions; // Variant ns=0;i=24
  receiveQosModify: boolean; // Boolean ns=0;i=1
}
export interface UDTReceiveQosSelection extends ExtensionObject, DTReceiveQosSelection {};