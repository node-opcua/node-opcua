// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTOutputInformation } from "./dt_output_information"
import { DTBOMComponentInformation } from "./dt_bom_component_information"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Jobs/                 |
 * | nodeClass |DataType                                                    |
 * | name      |BOMInformationDataType                                      |
 * | isAbstract|false                                                       |
 */
export interface DTBOMInformation extends DTStructure {
  /** Identification of the output.*/
  identification: DTOutputInformation; // ExtensionObject ns=10;i=3012
  /** Contains information about components.*/
  componentInformation: DTBOMComponentInformation[]; // ExtensionObject ns=10;i=3015
}
export interface UDTBOMInformation extends ExtensionObject, DTBOMInformation {};