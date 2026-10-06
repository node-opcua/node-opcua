import type { UInt16 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/AC/                          |
 * | nodeClass |DataType                                                    |
 * | name      |FxVersion                                                   |
 * | isAbstract|false                                                       |
 */
export interface DTFxVersion extends DTStructure {
  major: UInt16; // UInt16 ns=0;i=5
  minor: UInt16; // UInt16 ns=0;i=5
  build: UInt16; // UInt16 ns=0;i=5
  subBuild: UInt16; // UInt16 ns=0;i=5
}
export interface UDTFxVersion extends ExtensionObject, DTFxVersion {};