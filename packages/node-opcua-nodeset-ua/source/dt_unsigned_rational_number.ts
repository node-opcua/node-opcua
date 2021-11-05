// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |UnsignedRationalNumber                            |
 * | isAbstract|false                                             |
 */
export interface DTUnsignedRationalNumber extends DTStructure  {
  numerator: UInt32; // UInt32 ns=0;i=7
  denominator: UInt32; // UInt32 ns=0;i=7
}