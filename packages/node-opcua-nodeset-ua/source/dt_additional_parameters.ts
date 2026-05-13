import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |AdditionalParametersType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTAdditionalParameters extends DTStructure {
  parameters: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTAdditionalParameters extends ExtensionObject, DTAdditionalParameters {};