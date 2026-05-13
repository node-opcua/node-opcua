import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { Variant } from "node-opcua-variant";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |NameValuePair                                               |
 * | isAbstract|false                                                       |
 */
export interface DTNameValuePair extends DTStructure {
  name: UAString; // String ns=0;i=12
  value: Variant; // Variant ns=0;i=24
}
export interface UDTNameValuePair extends ExtensionObject, DTNameValuePair {};