// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int64, UInt64, UInt32, Int32, UInt16, Int16, Byte, SByte, UAString, Guid } from "node-opcua-basic-types"
import { DTUnion } from "node-opcua-nodeset-ua/source/dt_union"
/**
 * The WwArgumentValueDataType definition defines
 * the possible types of an argument value.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Woodworking/          |
 * | nodeClass |DataType                                          |
 * | name      |12:WwMessageArgumentValueDataType                 |
 * | isAbstract|false                                             |
 */
export interface DTWwMessageArgumentValue_0 extends DTUnion {
  /** The content of the value as an array of the own type*/
  array: DTWwMessageArgumentValue[]; // ExtensionObject ns=12;i=3002
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_1 extends DTUnion {
  array?: never
  /** The content of the value as a boolean*/
  boolean: boolean; // Boolean ns=0;i=1
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_2 extends DTUnion {
  array?: never
  boolean?: never
  /** The content of the value as a 16 bit integer*/
  int16: Int16; // Int16 ns=0;i=4
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_3 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  /** The content of the value as a 32 bit integer*/
  int32: Int32; // Int32 ns=0;i=6
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_4 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  /** The content of the value as a 64 bit integer*/
  int64: Int64; // Int64 ns=0;i=8
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_5 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  /** The content of the value as a 8 bit integer*/
  sByte: SByte; // SByte ns=0;i=2
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_6 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  /** The content of the value as a 16 bit unsigned integer*/
  uInt16: UInt16; // UInt16 ns=0;i=5
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_7 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  /** The content of the value as a 32 bit unsigned integer*/
  uInt32: UInt32; // UInt32 ns=0;i=7
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_8 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  /** The content of the value as a 64 bit unsigned integer*/
  uInt64: UInt64; // UInt64 ns=0;i=9
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_9 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  /** The content of the value as a 8 bit unsigned integer*/
  byte: Byte; // Byte ns=0;i=3
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_10 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  /** The content of the value as a datetime*/
  dateTime: Date; // DateTime ns=0;i=13
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_11 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  /** The content of the value as a GUID*/
  guid: Guid; // Guid ns=0;i=14
  localizedText?: never
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_12 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  /** The content of the value as a localized text*/
  localizedText: LocalizedText; // LocalizedText ns=0;i=21
  double?: never
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_13 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  /** The content of the value as a double*/
  double: number; // Double ns=0;i=11
  float?: never
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_14 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  /** The content of the value as a float*/
  float: number; // Float ns=0;i=10
  string?: never
  other?: never
}
export interface DTWwMessageArgumentValue_15 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  /** The content of the value as a string*/
  string: UAString; // String ns=0;i=12
  other?: never
}
export interface DTWwMessageArgumentValue_16 extends DTUnion {
  array?: never
  boolean?: never
  int16?: never
  int32?: never
  int64?: never
  sByte?: never
  uInt16?: never
  uInt32?: never
  uInt64?: never
  byte?: never
  dateTime?: never
  guid?: never
  localizedText?: never
  double?: never
  float?: never
  string?: never
  /** The content of the value has no standard format and is instantiated as a string*/
  other: UAString; // String ns=0;i=12
}
export type DTWwMessageArgumentValue = 
  | DTWwMessageArgumentValue_0
  | DTWwMessageArgumentValue_1
  | DTWwMessageArgumentValue_2
  | DTWwMessageArgumentValue_3
  | DTWwMessageArgumentValue_4
  | DTWwMessageArgumentValue_5
  | DTWwMessageArgumentValue_6
  | DTWwMessageArgumentValue_7
  | DTWwMessageArgumentValue_8
  | DTWwMessageArgumentValue_9
  | DTWwMessageArgumentValue_10
  | DTWwMessageArgumentValue_11
  | DTWwMessageArgumentValue_12
  | DTWwMessageArgumentValue_13
  | DTWwMessageArgumentValue_14
  | DTWwMessageArgumentValue_15
  | DTWwMessageArgumentValue_16
  ;