import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |BaseConfigurationDataType                                   |
 * | isAbstract|true                                                        |
 */
export interface DTBaseConfiguration extends DTStructure {
  configurationVersion: UInt32; // UInt32 ns=0;i=20998
  configurationProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTBaseConfiguration extends ExtensionObject, DTBaseConfiguration {};