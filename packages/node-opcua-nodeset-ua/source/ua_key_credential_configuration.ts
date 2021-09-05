// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { StatusCode } from "node-opcua-status-code"
import { UAString } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |KeyCredentialConfigurationType ns=0;i=18001       |
 * |isAbstract      |false                                             |
 */
export interface UAKeyCredentialConfiguration_Base {
    resourceUri: UAProperty<UAString, /*z*/DataType.String>;
    profileUri: UAProperty<UAString, /*z*/DataType.String>;
    endpointUrls?: UAProperty<UAString[], /*z*/DataType.String>;
    serviceStatus?: UAProperty<StatusCode, /*z*/DataType.StatusCode>;
    getEncryptingKey?: UAMethod;
    updateCredential?: UAMethod;
    deleteCredential?: UAMethod;
}
export interface UAKeyCredentialConfiguration extends UAObject, UAKeyCredentialConfiguration_Base {
}