// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |SecurityGroupType ns=0;i=15471                    |
 * |isAbstract      |false                                             |
 */
export interface UASecurityGroup_Base {
    securityGroupId: UAProperty<UAString, /*z*/DataType.String>;
    keyLifetime: UAProperty<number, /*z*/DataType.Double>;
    securityPolicyUri: UAProperty<UAString, /*z*/DataType.String>;
    maxFutureKeyCount: UAProperty<UInt32, /*z*/DataType.UInt32>;
    maxPastKeyCount: UAProperty<UInt32, /*z*/DataType.UInt32>;
    invalidateKeys?: UAMethod;
    forceKeyRotation?: UAMethod;
}
export interface UASecurityGroup extends UAObject, UASecurityGroup_Base {
}