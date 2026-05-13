import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { StatusCode } from "node-opcua-status-code";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |KeyCredentialConfigurationType i=18001                      |
 * |isAbstract      |false                                                       |
 */
export interface UAKeyCredentialConfiguration_Base {
    resourceUri: UAProperty<UAString, DataType.String>;
    profileUri: UAProperty<UAString, DataType.String>;
    endpointUrls?: UAProperty<UAString[], DataType.String>;
    credentialId?: UAProperty<UAString, DataType.String>;
    serviceStatus?: UAProperty<StatusCode, DataType.StatusCode>;
    getEncryptingKey?: UAMethod;
    updateCredential?: UAMethod;
    deleteCredential?: UAMethod;
}
export interface UAKeyCredentialConfiguration extends UAObject, UAKeyCredentialConfiguration_Base {}