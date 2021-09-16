// ----- this file has been automatically generated - do not edit
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * Structure of position elements.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/CNC                   |
 * | nodeClass |DataType                                          |
 * | name      |11:CncPositionDataType                            |
 * | isAbstract|false                                             |
 */
export interface DTCncPosition extends DTStructure  {
/** Position current value.*/
  actPos: number; // Double ns=0;i=11
/** Position setpoint value.*/
  cmdPos: number; // Double ns=0;i=11
/** Remaining distance.*/
  remDist: number; // Double ns=0;i=11
}