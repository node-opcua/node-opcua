// ----- this file has been automatically generated - do not edit
import { EUInformation } from "node-opcua-data-access"
import { Int32, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/PackML/               |
 * | nodeClass |DataType                                          |
 * | name      |15:PackMLDescriptorDataType                       |
 * | isAbstract|false                                             |
 */
export interface DTPackMLDescriptor extends DTStructure {
  /** A unique number assigned to the parameter*/
  ID: Int32; // Int32 ns=0;i=6
  /** The name of the parameter*/
  name: UAString; // String ns=0;i=12
  /** OPC UA engineering unit information*/
  unit: EUInformation; // ExtensionObject ns=0;i=887
  /** This is the numeric value of the parameter*/
  value: number; // Float ns=0;i=10
}
export interface UDTPackMLDescriptor extends ExtensionObject, DTPackMLDescriptor {};