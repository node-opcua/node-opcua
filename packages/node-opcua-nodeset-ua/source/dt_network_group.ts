import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTEndpointUrlList } from "./dt_endpoint_url_list";
import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |NetworkGroupDataType                                        |
 * | isAbstract|false                                                       |
 */
export interface DTNetworkGroup extends DTStructure {
  serverUri: UAString; // String ns=0;i=12
  networkPaths: DTEndpointUrlList[]; // ExtensionObject ns=0;i=11943
}
export interface UDTNetworkGroup extends ExtensionObject, DTNetworkGroup {};