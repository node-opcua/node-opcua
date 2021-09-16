// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTUserTokenPolicy } from "node-opcua-nodeset-ua/source/dt_user_token_policy"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/GDS/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |6:AuthorizationServiceType ns=6;i=966             |
 * |isAbstract      |false                                             |
 */
export interface UAAuthorizationService_Base {
    serviceUri: UAProperty<UAString, /*z*/DataType.String>;
    serviceCertificate: UAProperty<Buffer, /*z*/DataType.ByteString>;
    userTokenPolicies?: UAProperty<DTUserTokenPolicy[], /*z*/DataType.ExtensionObject>;
    getServiceDescription: UAMethod;
    requestAccessToken?: UAMethod;
}
export interface UAAuthorizationService extends UAObject, UAAuthorizationService_Base {
}