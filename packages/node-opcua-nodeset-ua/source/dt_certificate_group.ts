// ----- this file has been automatically generated - do not edit
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTBaseConfigurationRecord } from "./dt_base_configuration_record"
import { DTKeyValuePair } from "./dt_key_value_pair"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |CertificateGroupDataType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTCertificateGroup extends DTBaseConfigurationRecord {
  name: UAString; // String ns=0;i=12
  recordProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  purpose: NodeId; // NodeId ns=0;i=17
  certificateTypes: NodeId[]; // NodeId ns=0;i=17
  isCertificateAssigned: boolean[]; // Boolean ns=0;i=1
  validationOptions: UInt32; // UInt32 ns=0;i=23564
}
export interface UDTCertificateGroup extends ExtensionObject, DTCertificateGroup {};