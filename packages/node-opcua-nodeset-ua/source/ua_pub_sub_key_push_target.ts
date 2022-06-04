// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16, UAString } from "node-opcua-basic-types"
import { DTUserTokenPolicy } from "./dt_user_token_policy"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubKeyPushTargetType ns=0;i=25337              |
 * |isAbstract      |false                                             |
 */
export interface UAPubSubKeyPushTarget_Base {
    applicationUri: UAProperty<UAString, /*z*/DataType.String>;
    endpointUrl: UAProperty<UAString, /*z*/DataType.String>;
    securityPolicyUri: UAProperty<UAString, /*z*/DataType.String>;
    userTokenType: UAProperty<DTUserTokenPolicy, /*z*/DataType.ExtensionObject>;
    requestedKeyCount: UAProperty<UInt16, /*z*/DataType.UInt16>;
    retryInterval: UAProperty<number, /*z*/DataType.Double>;
    lastPushExecutionTime: UAProperty<Date, /*z*/DataType.DateTime>;
    lastPushErrorTime: UAProperty<Date, /*z*/DataType.DateTime>;
    connectSecurityGroups: UAMethod;
    disconnectSecurityGroups: UAMethod;
    triggerKeyUpdate: UAMethod;
}
export interface UAPubSubKeyPushTarget extends UAObject, UAPubSubKeyPushTarget_Base {
}