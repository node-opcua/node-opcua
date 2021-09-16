// ----- this file has been automatically generated - do not edit
import { Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/GDS/                  |
 * | nodeClass |DataType                                          |
 * | name      |6:ApplicationRecordDataType                       |
 * | isAbstract|false                                             |
 */
export interface DTApplicationRecord extends DTStructure  {
  applicationId: NodeId; // NodeId ns=0;i=17
  applicationUri: UAString; // String ns=0;i=12
  applicationType: Variant; // Variant ns=0;i=307
  applicationNames: LocalizedText[]; // LocalizedText ns=0;i=21
  productUri: UAString; // String ns=0;i=12
  discoveryUrls: UAString[]; // String ns=0;i=12
  serverCapabilities: UAString[]; // String ns=0;i=12
}