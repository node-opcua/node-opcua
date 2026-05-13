import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ConfigurationVersionDataType                                |
 * | isAbstract|false                                                       |
 */
export interface DTConfigurationVersion extends DTStructure {
  majorVersion: UInt32; // UInt32 ns=0;i=20998
  minorVersion: UInt32; // UInt32 ns=0;i=20998
}
export interface UDTConfigurationVersion extends ExtensionObject, DTConfigurationVersion {};