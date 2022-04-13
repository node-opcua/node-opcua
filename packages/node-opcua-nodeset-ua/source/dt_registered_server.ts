// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
import { EnumApplication } from "./enum_application"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |RegisteredServer                                  |
 * | isAbstract|false                                             |
 */
export interface DTRegisteredServer extends DTStructure  {
  serverUri: UAString; // String ns=0;i=12
  productUri: UAString; // String ns=0;i=12
  serverNames: LocalizedText[]; // LocalizedText ns=0;i=21
  serverType: EnumApplication; // Int32 ns=0;i=307
  gatewayServerUri: UAString; // String ns=0;i=12
  discoveryUrls: UAString[]; // String ns=0;i=12
  semaphoreFilePath: UAString; // String ns=0;i=12
  isOnline: boolean; // Boolean ns=0;i=1
}