import type { UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Scales/V2/                      |
 * | nodeClass |DataType                                                    |
 * | name      |RecipeThresholdType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTRecipeThreshold extends DTStructure {
  thresholdId: UInt32; // UInt32 ns=0;i=7
  thresholdNodeId?: NodeId; // NodeId ns=0;i=17
  thresholdName: LocalizedText; // LocalizedText ns=0;i=21
}
export interface UDTRecipeThreshold extends ExtensionObject, DTRecipeThreshold {};