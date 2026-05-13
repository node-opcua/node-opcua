import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTStructure } from "./dt_structure";
import type { EnumApplication } from "./enum_application";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |RegisteredServer                                            |
 * | isAbstract|false                                                       |
 */
export interface DTRegisteredServer extends DTStructure {
  serverUri: UAString; // String ns=0;i=12
  productUri: UAString; // String ns=0;i=12
  serverNames: LocalizedText[]; // LocalizedText ns=0;i=21
  serverType: EnumApplication; // Int32 ns=0;i=307
  gatewayServerUri: UAString; // String ns=0;i=12
  discoveryUrls: UAString[]; // String ns=0;i=12
  semaphoreFilePath: UAString; // String ns=0;i=12
  isOnline: boolean; // Boolean ns=0;i=1
}
export interface UDTRegisteredServer extends ExtensionObject, DTRegisteredServer {};