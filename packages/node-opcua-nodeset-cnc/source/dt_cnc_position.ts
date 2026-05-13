import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * Structure of position elements.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/CNC                             |
 * | nodeClass |DataType                                                    |
 * | name      |CncPositionDataType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTCncPosition extends DTStructure {
  /** Position current value.*/
  actPos: number; // Double ns=0;i=11
  /** Position setpoint value.*/
  cmdPos: number; // Double ns=0;i=11
  /** Remaining distance.*/
  remDist: number; // Double ns=0;i=11
}
export interface UDTCncPosition extends ExtensionObject, DTCncPosition {};