// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |ConfigurationVersionDataType                      |
 * | isAbstract|false                                             |
 */
export interface DTConfigurationVersion extends DTStructure {
  majorVersion: UInt32; // UInt32 ns=0;i=20998
  minorVersion: UInt32; // UInt32 ns=0;i=20998
}
export interface UDTConfigurationVersion extends ExtensionObject, DTConfigurationVersion {};