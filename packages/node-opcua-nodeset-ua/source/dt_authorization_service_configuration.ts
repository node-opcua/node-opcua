import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTBaseConfigurationRecord } from "./dt_base_configuration_record";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTServiceCertificate } from "./dt_service_certificate";

// ----- this file has been automatically generated - do not edit

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