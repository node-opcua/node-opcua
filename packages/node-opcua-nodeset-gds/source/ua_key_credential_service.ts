// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/GDS/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |6:KeyCredentialServiceType ns=6;i=1020            |
 * |isAbstract      |false                                             |
 */
export interface UAKeyCredentialService_Base {
    resourceUri: UAProperty<UAString, /*z*/DataType.String>;
    profileUris: UAProperty<UAString[], /*z*/DataType.String>;
    startRequest: UAMethod;
    finishRequest: UAMethod;
    revoke?: UAMethod;
}
export interface UAKeyCredentialService extends UAObject, UAKeyCredentialService_Base {
}