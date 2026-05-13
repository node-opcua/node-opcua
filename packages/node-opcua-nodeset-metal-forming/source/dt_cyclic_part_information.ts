import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MetalForming/                   |
 * | nodeClass |DataType                                                    |
 * | name      |CyclicPartInformationDataType                               |
 * | isAbstract|false                                                       |
 */
export interface DTCyclicPartInformation extends DTStructure {
  cycleCount: UInt32; // UInt32 ns=0;i=289
  partId?: UAString; // String ns=0;i=12
}
export interface UDTCyclicPartInformation extends ExtensionObject, DTCyclicPartInformation {};