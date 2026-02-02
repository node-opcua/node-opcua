// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTBaseConfiguration } from "./dt_base_configuration"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { DTApplicationIdentity } from "./dt_application_identity"
import { DTCertificateGroup } from "./dt_certificate_group"
import { DTServerEndpoint } from "./dt_server_endpoint"
import { DTEndpoint } from "./dt_endpoint"
import { DTSecuritySettings } from "./dt_security_settings"
import { DTUserTokenSettings } from "./dt_user_token_settings"
import { DTAuthorizationServiceConfiguration } from "./dt_authorization_service_configuration"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |ApplicationConfigurationDataType                            |
 * | isAbstract|false                                                       |
 */
export interface DTApplicationConfiguration extends DTBaseConfiguration {
  configurationVersion: UInt32; // UInt32 ns=0;i=20998
  configurationProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
  applicationIdentity: DTApplicationIdentity; // ExtensionObject ns=0;i=15556
  certificateGroups: DTCertificateGroup[]; // ExtensionObject ns=0;i=15436
  serverEndpoints: DTServerEndpoint[]; // ExtensionObject ns=0;i=15558
  clientEndpoints: DTEndpoint[]; // ExtensionObject ns=0;i=15557
  securitySettings: DTSecuritySettings[]; // ExtensionObject ns=0;i=15559
  userTokenSettings: DTUserTokenSettings[]; // ExtensionObject ns=0;i=15560
  authorizationServices: DTAuthorizationServiceConfiguration[]; // ExtensionObject ns=0;i=23744
}
export interface UDTApplicationConfiguration extends ExtensionObject, DTApplicationConfiguration {};