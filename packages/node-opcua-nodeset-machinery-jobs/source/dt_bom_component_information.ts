// ----- this file has been automatically generated - do not edit
import { EUInformation } from "node-opcua-data-access"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTOutputInformation } from "./dt_output_information"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Jobs/                 |
 * | nodeClass |DataType                                                    |
 * | name      |BOMComponentInformationDataType                             |
 * | isAbstract|false                                                       |
 */
export interface DTBOMComponentInformation extends DTStructure {
  /** Identification of the output.*/
  identification: DTOutputInformation; // ExtensionObject ns=10;i=3012
  /** Quantity defines the amount of material. This quantity can be specified in different ways, e.g. weight or number.*/
  quantity: number; // Double ns=0;i=11
  /** The engineering unit of the quantity.*/
  engineeringUnits: EUInformation; // ExtensionObject ns=0;i=887
}
export interface UDTBOMComponentInformation extends ExtensionObject, DTBOMComponentInformation {};