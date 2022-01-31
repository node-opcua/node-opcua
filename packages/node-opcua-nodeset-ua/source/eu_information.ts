// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int32, UAString } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |EUInformation                                     |
 * | isAbstract|false                                             |
 */
export interface EUInformation extends DTStructure  {
  namespaceUri: UAString; // String ns=0;i=12
  unitId: Int32; // Int32 ns=0;i=6
  displayName: LocalizedText; // LocalizedText ns=0;i=21
  description: LocalizedText; // LocalizedText ns=0;i=21
}