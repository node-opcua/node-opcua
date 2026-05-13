import type { Int32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/                         |
 * | nodeClass |DataType                                                    |
 * | name      |Position                                                    |
 * | isAbstract|false                                                       |
 */
export interface DTPosition extends DTStructure {
  positionX: Int32; // Int32 ns=0;i=6
  positionY: Int32; // Int32 ns=0;i=6
  sizeX: Int32; // Int32 ns=0;i=6
  sizeY: Int32; // Int32 ns=0;i=6
  rotation: Int32; // Int32 ns=0;i=6
}
export interface UDTPosition extends ExtensionObject, DTPosition {};