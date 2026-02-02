// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTBaseConfigurationRecord } from "./dt_base_configuration_record"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { DTServiceCertificate } from "./dt_service_certificate"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |AuthorizationServiceConfigurationDataType                   |
 * | isAbstract|false                                                       |
 */
export interface DTAuthorizationServiceConfiguration extends DTBaseConfigurationRecord {
  name: UAString; // String ns=0;i=12
  recordProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  serviceUri: UAString; // String ns=0;i=23751
  serviceCertificates: DTServiceCertificate[]; // ExtensionObject ns=0;i=23724
  issuerEndpointSettings: UAString; // String ns=0;i=12
}
export interface UDTAuthorizationServiceConfiguration extends ExtensionObject, DTAuthorizationServiceConfiguration {};