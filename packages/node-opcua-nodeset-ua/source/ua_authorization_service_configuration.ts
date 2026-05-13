import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuthorizationServiceConfigurationType i=17852               |
 * |isAbstract      |false                                                       |
 */
export interface UAAuthorizationServiceConfiguration_Base {
    serviceUri: UAProperty<UAString, DataType.String>;
    serviceCertificate: UAProperty<Buffer, DataType.ByteString>;
    issuerEndpointUrl: UAProperty<UAString, DataType.String>;
}
export interface UAAuthorizationServiceConfiguration extends UAObject, UAAuthorizationServiceConfiguration_Base {}