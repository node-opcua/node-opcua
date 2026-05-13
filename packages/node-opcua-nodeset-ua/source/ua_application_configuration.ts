import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumApplication } from "./enum_application";
import type { UAAuthorizationServicesConfigurationFolder } from "./ua_authorization_services_configuration_folder";
import type { UAKeyCredentialConfigurationFolder } from "./ua_key_credential_configuration_folder";
import type { UAServerConfiguration, UAServerConfiguration_Base } from "./ua_server_configuration";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ApplicationConfigurationType i=25731                        |
 * |isAbstract      |false                                                       |
 */
export interface UAApplicationConfiguration_Base extends UAServerConfiguration_Base {
    applicationUri: UAProperty<UAString, DataType.String>;
    productUri: UAProperty<UAString, DataType.String>;
    applicationType: UAProperty<EnumApplication, DataType.Int32>;
    enabled: UAProperty<boolean, DataType.Boolean>;
    isNonUaApplication?: UAProperty<boolean, DataType.Boolean>;
    keyCredentials?: UAKeyCredentialConfigurationFolder;
    authorizationServices?: UAAuthorizationServicesConfigurationFolder;
}
export interface UAApplicationConfiguration extends Omit<UAServerConfiguration, "applicationUri"|"productUri"|"applicationType">, UAApplicationConfiguration_Base {}