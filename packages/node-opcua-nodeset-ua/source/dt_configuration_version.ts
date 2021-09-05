// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |ConfigurationVersionDataType                      |
 * | isAbstract|false                                             |
 */
export interface DTConfigurationVersion extends DTStructure  {
  majorVersion: UInt32; // UInt32 ns=0;i=20998
  minorVersion: UInt32; // UInt32 ns=0;i=20998
}