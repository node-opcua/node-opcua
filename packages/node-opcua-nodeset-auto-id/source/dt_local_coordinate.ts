import type { Int32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/                         |
 * | nodeClass |DataType                                                    |
 * | name      |LocalCoordinate                                             |
 * | isAbstract|false                                                       |
 */
export interface DTLocalCoordinate extends DTStructure {
  x: number; // Double ns=0;i=11
  y: number; // Double ns=0;i=11
  z: number; // Double ns=0;i=11
  /** Optional*/
  timestamp: Date; // DateTime ns=0;i=294
  /** Optional*/
  dilutionOfPrecision: number; // Double ns=0;i=11
  /** Optional*/
  usefulPrecision: Int32; // Int32 ns=0;i=6
}
export interface UDTLocalCoordinate extends ExtensionObject, DTLocalCoordinate {};