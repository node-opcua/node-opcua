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
 * | name      |15:PackMLCountDataType                            |
 * | isAbstract|false                                             |
 */
export interface DTPackMLCount extends DTStructure {
  /** A user defined value that represents the consumed (processed or defective) material. Typically this is an SKU number or a user material master number.*/
  ID: Int32; // Int32 ns=0;i=6
  /** A string description of the material.*/
  name: UAString; // String ns=0;i=12
  /** OPC UA engineering unit information for the count.*/
  unit: EUInformation; // ExtensionObject ns=0;i=887
  /** The amount of consumed (processed or defective) material on the current production job.*/
  count: Int32; // Int32 ns=0;i=6
  /** The cumulative count value of the material produced (or consumed). This counter gives the user a non-resetting counter that may be used for OEE calculations*/
  accCount: Int32; // Int32 ns=0;i=6
}
export interface UDTPackMLCount extends ExtensionObject, DTPackMLCount {};