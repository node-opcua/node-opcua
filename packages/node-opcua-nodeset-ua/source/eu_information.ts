import type { Int32, UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |EUInformation                                               |
 * | isAbstract|false                                                       |
 */
export interface EUInformation extends DTStructure {
  namespaceUri: UAString; // String ns=0;i=12
  unitId: Int32; // Int32 ns=0;i=6
  displayName: LocalizedText; // LocalizedText ns=0;i=21
  description: LocalizedText; // LocalizedText ns=0;i=21
}
export interface UEUInformation extends ExtensionObject, EUInformation {};