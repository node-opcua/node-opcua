import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SecurityGroupType i=15471                                   |
 * |isAbstract      |false                                                       |
 */
export interface UASecurityGroup_Base {
    securityGroupId: UAProperty<UAString, DataType.String>;
    keyLifetime: UAProperty<number, DataType.Double>;
    securityPolicyUri: UAProperty<UAString, DataType.String>;
    maxFutureKeyCount: UAProperty<UInt32, DataType.UInt32>;
    maxPastKeyCount: UAProperty<UInt32, DataType.UInt32>;
    invalidateKeys?: UAMethod;
    forceKeyRotation?: UAMethod;
}
export interface UASecurityGroup extends UAObject, UASecurityGroup_Base {}