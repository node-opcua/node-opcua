// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTEndpointDescription } from "./dt_endpoint_description"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { UAPubSubStatus } from "./ua_pub_sub_status"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PubSubGroupType ns=0;i=14232                      |
 * |isAbstract      |true                                              |
 */
export interface UAPubSubGroup_Base {
    securityMode: UAProperty<any, any>;
    securityGroupId?: UAProperty<UAString, /*z*/DataType.String>;
    securityKeyServices?: UAProperty<DTEndpointDescription[], /*z*/DataType.ExtensionObject>;
    maxNetworkMessageSize: UAProperty<UInt32, /*z*/DataType.UInt32>;
    groupProperties: UAProperty<DTKeyValuePair[], /*z*/DataType.ExtensionObject>;
    status: UAPubSubStatus;
}
export interface UAPubSubGroup extends UAObject, UAPubSubGroup_Base {
}