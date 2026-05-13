import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { EnumPatDictionaryEnum } from "./enum_pat_dictionary_enum";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/PADIM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ChemicalSubstanceDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTChemicalSubstance extends DTStructure {
  patDictionary?: EnumPatDictionaryEnum; // Int32 ns=24;i=1276
  label: LocalizedText; // LocalizedText ns=0;i=21
  id: LocalizedText; // LocalizedText ns=0;i=21
}
export interface UDTChemicalSubstance extends ExtensionObject, DTChemicalSubstance {};