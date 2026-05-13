import type { UAString } from "node-opcua-basic-types";
import type { EUInformation } from "node-opcua-data-access";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTISA95Property } from "./dt_isa_95_property";

// ----- this file has been automatically generated - do not edit

/**
 * Defines an equipment resource or a piece of
 * equipment, a quantity, an optional description,
 * and an optional collection of properties.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * | nodeClass |DataType                                                    |
 * | name      |ISA95EquipmentDataType                                      |
 * | isAbstract|false                                                       |
 */
export interface DTISA95Equipment extends DTStructure {
  /** An identification of an EquipmentClass or Equipment.*/
  ID: UAString; // String ns=0;i=12
  /** Additional information and description about the resource.*/
  description?: LocalizedText[]; // LocalizedText ns=0;i=21
  /** Information about the expected use of the equipment, see the ISA 95 Part 2 standard for defined values.*/
  equipmentUse?: UAString; // String ns=0;i=12
  /** The quantity of the resource*/
  quantity?: UAString; // String ns=0;i=12878
  /** The Unit Of Measure of the quantity*/
  engineeringUnits?: EUInformation; // ExtensionObject ns=0;i=887
  /** Any associated properties, or empty if there are no properties defined.*/
  properties?: DTISA95Property[]; // ExtensionObject ns=9;i=3002
}
export interface UDTISA95Equipment extends ExtensionObject, DTISA95Equipment {};