// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { DTEndpointUrlList } from "./dt_endpoint_url_list"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |NetworkGroupDataType                              |
 * | isAbstract|false                                             |
 */
export interface DTNetworkGroup extends DTStructure  {
  serverUri: UAString; // String ns=0;i=12
  networkPaths: DTEndpointUrlList[]; // ExtensionObject ns=0;i=11943
}