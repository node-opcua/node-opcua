import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/                         |
 * | nodeClass |DataType                                                    |
 * | name      |Rotation                                                    |
 * | isAbstract|false                                                       |
 */
export interface DTRotation extends DTStructure {
  yaw: number; // Double ns=0;i=11
  pitch: number; // Double ns=0;i=11
  roll: number; // Double ns=0;i=11
}
export interface UDTRotation extends ExtensionObject, DTRotation {};