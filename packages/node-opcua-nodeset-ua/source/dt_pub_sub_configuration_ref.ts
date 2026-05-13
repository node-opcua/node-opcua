import type { UInt16, UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubConfigurationRefDataType                              |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubConfigurationRef extends DTStructure {
  configurationMask: UInt32; // UInt32 ns=0;i=25517
  elementIndex: UInt16; // UInt16 ns=0;i=5
  connectionIndex: UInt16; // UInt16 ns=0;i=5
  groupIndex: UInt16; // UInt16 ns=0;i=5
}
export interface UDTPubSubConfigurationRef extends ExtensionObject, DTPubSubConfigurationRef {};