// ----- this file has been automatically generated - do not edit
import { Int32, UInt16, UAString } from "node-opcua-basic-types"
import { DTAccessResult } from "./dt_access_result"
import { DTScanData } from "./dt_scan_data"
/**
 * Additional result values of an Rfid Transponder
 * access.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:RfidAccessResult                                |
 * | isAbstract|false                                             |
 */
export interface DTRfidAccessResult extends DTAccessResult  {
/** Defines the format of Identifier as string.*/
  codeType: UAString; // String ns=3;i=3031
/** The AutoID Identifier (e.g. a code or a transponder) which was accessed by a command.*/
  identifier: DTScanData; // ExtensionObject ns=3;i=3020
/** The point of time the AutoID Identifier was accessed by the command.*/
  timestamp: Date; // DateTime ns=0;i=294
/** Defines the format of RWData as string.*/
  codeTypeRWData: UAString; // String ns=3;i=3031
/** The user data which was written to / was read from the Rfid Transponder by the command.*/
  rwData: DTScanData; // ExtensionObject ns=3;i=3020
/** The antenna by which the transponder was accessed by the command.*/
  antenna: Int32; // Int32 ns=0;i=6
/** The power level with which the transponder was accessed by the command.*/
  currentPowerLevel: Int32; // Int32 ns=0;i=6
/** The Protocol Control Word of the transponder accessed by the command.*/
  PC: UInt16; // UInt16 ns=0;i=5
/** The polarization with which the last transponder was accessed by the command.*/
  polarization: UAString; // String ns=0;i=12
/** The Rssi value with which the transponder was accessed by the command.*/
  strength: Int32; // Int32 ns=0;i=6
}