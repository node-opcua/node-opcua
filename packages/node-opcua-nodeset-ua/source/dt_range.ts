// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |Range                                                       |
 * | isAbstract|false                                                       |
 */
export interface DTRange extends DTStructure {
  low: number; // Double ns=0;i=11
  high: number; // Double ns=0;i=11
}
export interface UDTRange extends ExtensionObject, DTRange {};