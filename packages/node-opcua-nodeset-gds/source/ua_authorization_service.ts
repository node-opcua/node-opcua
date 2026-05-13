import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DTUserTokenPolicy } from "node-opcua-nodeset-ua/dist/dt_user_token_policy";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/GDS/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuthorizationServiceType i=966                              |
 * |isAbstract      |false                                                       |
 */
export interface UAAuthorizationService_Base {
    serviceUri: UAProperty<UAString, DataType.String>;
    serviceCertificate: UAProperty<Buffer, DataType.ByteString>;
    userTokenPolicies?: UAProperty<DTUserTokenPolicy[], DataType.ExtensionObject>;
    getServiceDescription: UAMethod;
    requestAccessToken?: UAMethod;
}
export interface UAAuthorizationService extends UAObject, UAAuthorizationService_Base {}