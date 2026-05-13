import type { UAString } from "node-opcua-basic-types";
import type { EUInformation } from "node-opcua-data-access";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";
import type { Variant } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * A subtype of OPC UA Structure that defines two
 * linked data items: an ID, which is a unique
 * identifier for a property within the scope of the
 * associated resource, and the value, which is the
 * data for the property.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * | nodeClass |DataType                                                    |
 * | name      |ISA95PropertyDataType                                       |
 * | isAbstract|false                                                       |
 */
export interface DTISA95Property extends DTStructure {
  /** Unique identifier for a property within the scope of the associated resource*/
  ID: UAString; // String ns=0;i=12
  /** Value for the property*/
  value: Variant; // Variant ns=0;i=24
  /** An optional description of the parameter.*/
  description?: LocalizedText[]; // LocalizedText ns=0;i=21
  /** The Unit Of Measure of the value*/
  engineeringUnits?: EUInformation; // ExtensionObject ns=0;i=887
  subproperties?: DTISA95Property[]; // ExtensionObject ns=9;i=3002
}
export interface UDTISA95Property extends ExtensionObject, DTISA95Property {};