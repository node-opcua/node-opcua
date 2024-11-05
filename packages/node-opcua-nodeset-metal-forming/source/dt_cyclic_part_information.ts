// ----- this file has been automatically generated - do not edit
import { UInt32, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
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