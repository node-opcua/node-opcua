import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |NumberRange                                                 |
 * | isAbstract|false                                                       |
 */
export interface DTNumberRange extends DTStructure {
  low: number; // Variant ns=0;i=26
  high: number; // Variant ns=0;i=26
}
export interface UDTNumberRange extends ExtensionObject, DTNumberRange {};