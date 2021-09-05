// ----- this file has been automatically generated - do not edit
import { UInt32, Int32 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |RationalNumber                                    |
 * | isAbstract|false                                             |
 */
export interface DTRationalNumber extends DTStructure  {
  numerator: Int32; // Int32 ns=0;i=6
  denominator: UInt32; // UInt32 ns=0;i=7
}