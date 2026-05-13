import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTBOMComponentInformation } from "./dt_bom_component_information";
import type { DTOutputInformation } from "./dt_output_information";

// ----- this file has been automatically generated - do not edit

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