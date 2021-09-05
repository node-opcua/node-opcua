// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |BuildInfo                                         |
 * | isAbstract|false                                             |
 */
export interface DTBuildInfo extends DTStructure  {
  productUri: UAString; // String ns=0;i=12
  manufacturerName: UAString; // String ns=0;i=12
  productName: UAString; // String ns=0;i=12
  softwareVersion: UAString; // String ns=0;i=12
  buildNumber: UAString; // String ns=0;i=12
  buildDate: Date; // DateTime ns=0;i=294
}