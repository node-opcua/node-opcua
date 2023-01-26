// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { EnumApplication } from "node-opcua-nodeset-ua/source/enum_application"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/GDS/                  |
 * | nodeClass |DataType                                          |
 * | name      |6:ApplicationRecordDataType                       |
 * | isAbstract|false                                             |
 */
export interface DTApplicationRecord extends DTStructure {
  applicationId: NodeId; // NodeId ns=0;i=17
  applicationUri: UAString; // String ns=0;i=12
  applicationType: EnumApplication; // Int32 ns=0;i=307
  applicationNames: LocalizedText[]; // LocalizedText ns=0;i=21
  productUri: UAString; // String ns=0;i=12
  discoveryUrls: UAString[]; // String ns=0;i=12
  serverCapabilities: UAString[]; // String ns=0;i=12
}
export interface UDTApplicationRecord extends ExtensionObject, DTApplicationRecord {};