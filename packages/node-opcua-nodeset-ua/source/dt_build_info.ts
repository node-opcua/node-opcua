import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |BuildInfo                                                   |
 * | isAbstract|false                                                       |
 */
export interface DTBuildInfo extends DTStructure {
  productUri: UAString; // String ns=0;i=12
  manufacturerName: UAString; // String ns=0;i=12
  productName: UAString; // String ns=0;i=12
  softwareVersion: UAString; // String ns=0;i=12
  buildNumber: UAString; // String ns=0;i=12
  buildDate: Date; // DateTime ns=0;i=294
}
export interface UDTBuildInfo extends ExtensionObject, DTBuildInfo {};