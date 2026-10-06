import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure.js";

import type { DTApplicationId } from "./dt_application_id.js";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/FX/AC/                          |
 * | nodeClass |DataType                                                    |
 * | name      |ApplicationIdentifierDataType                               |
 * | isAbstract|false                                                       |
 */
export interface DTApplicationIdentifier extends DTStructure {
  name: LocalizedText; // LocalizedText ns=0;i=21
  uniqueIdentifier: DTApplicationId; // ExtensionObject ns=34;i=3013
}
export interface UDTApplicationIdentifier extends ExtensionObject, DTApplicationIdentifier {};