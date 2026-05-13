import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/GDS/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |KeyCredentialServiceType i=1020                             |
 * |isAbstract      |false                                                       |
 */
export interface UAKeyCredentialService_Base {
    resourceUri: UAProperty<UAString, DataType.String>;
    profileUris: UAProperty<UAString[], DataType.String>;
    securityPolicyUris?: UAProperty<UAString[], DataType.String>;
    startRequest: UAMethod;
    finishRequest: UAMethod;
    revoke?: UAMethod;
}
export interface UAKeyCredentialService extends UAObject, UAKeyCredentialService_Base {}