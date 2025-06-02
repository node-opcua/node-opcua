// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
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