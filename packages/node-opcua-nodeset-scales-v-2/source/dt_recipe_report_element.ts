import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Scales/V2/                      |
 * | nodeClass |DataType                                                    |
 * | name      |RecipeReportElementType                                     |
 * | isAbstract|false                                                       |
 */
export interface DTRecipeReportElement extends DTStructure {
  reportMessage: LocalizedText; // LocalizedText ns=0;i=21
  timestamp: Date; // DateTime ns=0;i=294
}
export interface UDTRecipeReportElement extends ExtensionObject, DTRecipeReportElement {};