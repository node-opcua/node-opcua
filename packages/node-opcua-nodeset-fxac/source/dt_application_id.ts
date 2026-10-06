import type { Guid, UAString, UInt32 } from "node-opcua-basic-types";
import type { DTUnion } from "node-opcua-nodeset-ua/dist/dt_union.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/AC/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ApplicationId                                               |
 * | isAbstract|false                                                       |
 */
export interface DTApplicationId_0 extends DTUnion {
  idNumeric: UInt32; // UInt32 ns=0;i=7
  idString?: never
  idGuid?: never
  idByteString?: never
}
export interface DTApplicationId_1 extends DTUnion {
  idNumeric?: never
  idString: UAString; // String ns=0;i=12
  idGuid?: never
  idByteString?: never
}
export interface DTApplicationId_2 extends DTUnion {
  idNumeric?: never
  idString?: never
  idGuid: Guid; // Guid ns=0;i=14
  idByteString?: never
}
export interface DTApplicationId_3 extends DTUnion {
  idNumeric?: never
  idString?: never
  idGuid?: never
  idByteString: Buffer; // ByteString ns=0;i=15
}
export type DTApplicationId = 
  | DTApplicationId_0
  | DTApplicationId_1
  | DTApplicationId_2
  | DTApplicationId_3
  ;