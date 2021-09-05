// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |EndpointUrlListDataType                           |
 * | isAbstract|false                                             |
 */
export interface DTEndpointUrlList extends DTStructure  {
  endpointUrlList: UAString[]; // String ns=0;i=12
}