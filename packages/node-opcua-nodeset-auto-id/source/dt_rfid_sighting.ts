// ----- this file has been automatically generated - do not edit
import { Int32 } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:RfidSighting                                    |
 * | isAbstract|false                                             |
 */
export interface DTRfidSighting extends DTStructure  {
/** Returns the number of the antenna which detects the RFID tag first.*/
  antenna: Int32; // Int32 ns=0;i=6
/** Returns the signal strength (RSSI) of the transponder. Higher values indicate a better strength.*/
  strength: Int32; // Int32 ns=0;i=6
/** Timestamp in UtcTime*/
  timestamp: Date; // DateTime ns=0;i=294
/** Returns the current power level (unit according to parameter settings).*/
  currentPowerLevel: Int32; // Int32 ns=0;i=6
}