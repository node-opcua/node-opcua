// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTOrientation } from "./dt_orientation"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |3DOrientation                                     |
 * | isAbstract|false                                             |
 */
export interface DT3DOrientation extends DTOrientation {
  a: number; // Double ns=0;i=11
  b: number; // Double ns=0;i=11
  c: number; // Double ns=0;i=11
}
export interface UDT3DOrientation extends ExtensionObject, DT3DOrientation {};