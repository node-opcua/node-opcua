// ----- this file has been automatically generated - do not edit
import { VariantOptions } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * A subtype of OPC UA Structure that defines three
 * linked data items: the ID, which is a unique
 * identifier for a property, the value, which is
 * the data that is identified, and an optional
 * description of the parameter.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * | nodeClass |DataType                                                    |
 * | name      |ISA95ParameterDataType                                      |
 * | isAbstract|false                                                       |
 */
export interface DTISA95Parameter extends DTStructure {
  /** A unique identifier for a parameter*/
  ID: UAString; // String ns=0;i=12
  /** Value of the parameter.*/
  value: VariantOptions; // Variant ns=0;i=0
  /** An optional description of the parameter. The array allows to provide descriptions in different languages when writing. When accessing, the server shall only provide one entry in the array.*/
  description?: LocalizedText[]; // LocalizedText ns=0;i=21
  /** The Unit Of Measure of the value*/
  engineeringUnits?: EUInformation; // ExtensionObject ns=0;i=887
  subparameters?: DTISA95Parameter[]; // ExtensionObject ns=9;i=3003
}
export interface UDTISA95Parameter extends ExtensionObject, DTISA95Parameter {};