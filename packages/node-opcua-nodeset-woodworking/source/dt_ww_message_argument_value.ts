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
export interface DTWwMessageArgumentValue extends DTUnion  {
/** The content of the value as an array of the own type*/
  array: DTWwMessageArgumentValue[]; // ExtensionObject ns=12;i=3002
/** The content of the value as a boolean*/
  boolean: boolean; // Boolean ns=0;i=1
/** The content of the value as a 16 bit integer*/
  int16: Int16; // Int16 ns=0;i=4
/** The content of the value as a 32 bit integer*/
  int32: Int32; // Int32 ns=0;i=6
/** The content of the value as a 64 bit integer*/
  int64: Int64; // Int64 ns=0;i=8
/** The content of the value as a 8 bit integer*/
  sByte: SByte; // SByte ns=0;i=2
/** The content of the value as a 16 bit unsigned integer*/
  uInt16: UInt16; // UInt16 ns=0;i=5
/** The content of the value as a 32 bit unsigned integer*/
  uInt32: UInt32; // UInt32 ns=0;i=7
/** The content of the value as a 64 bit unsigned integer*/
  uInt64: UInt64; // UInt64 ns=0;i=9
/** The content of the value as a 8 bit unsigned integer*/
  byte: Byte; // Byte ns=0;i=3
/** The content of the value as a datetime*/
  dateTime: Date; // DateTime ns=0;i=13
/** The content of the value as a GUID*/
  guid: Guid; // Guid ns=0;i=14
/** The content of the value as a localized text*/
  localizedText: LocalizedText; // LocalizedText ns=0;i=21
/** The content of the value as a double*/
  double: number; // Double ns=0;i=11
/** The content of the value as a float*/
  float: number; // Float ns=0;i=10
/** The content of the value as a string*/
  string: UAString; // String ns=0;i=12
/** The content of the value has no standard format and is instantiated as a string*/
  other: UAString; // String ns=0;i=12
}