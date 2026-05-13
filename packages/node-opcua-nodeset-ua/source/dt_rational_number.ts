import type { Int32, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |RationalNumber                                              |
 * | isAbstract|false                                                       |
 */
export interface DTRationalNumber extends DTStructure {
  numerator: Int32; // Int32 ns=0;i=6
  denominator: UInt32; // UInt32 ns=0;i=7
}
export interface UDTRationalNumber extends ExtensionObject, DTRationalNumber {};