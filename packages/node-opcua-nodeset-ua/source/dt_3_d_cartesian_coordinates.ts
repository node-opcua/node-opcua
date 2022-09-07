// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTCartesianCoordinates } from "./dt_cartesian_coordinates"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |3DCartesianCoordinates                            |
 * | isAbstract|false                                             |
 */
export interface DT3DCartesianCoordinates extends DTCartesianCoordinates {
  x: number; // Double ns=0;i=11
  y: number; // Double ns=0;i=11
  z: number; // Double ns=0;i=11
}
export interface UDT3DCartesianCoordinates extends ExtensionObject, DT3DCartesianCoordinates {};