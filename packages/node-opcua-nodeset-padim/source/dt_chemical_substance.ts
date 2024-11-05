// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { EnumPatDictionaryEnum } from "./enum_pat_dictionary_enum"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/PADIM/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ChemicalSubstanceDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTChemicalSubstance extends DTStructure {
  patDictionary: EnumPatDictionaryEnum; // Int32 ns=24;i=1276
  label: LocalizedText; // LocalizedText ns=0;i=21
  id: LocalizedText; // LocalizedText ns=0;i=21
}
export interface UDTChemicalSubstance extends ExtensionObject, DTChemicalSubstance {};