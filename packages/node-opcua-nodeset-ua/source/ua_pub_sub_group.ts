import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTEndpointDescription } from "./dt_endpoint_description";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { EnumMessageSecurityMode } from "./enum_message_security_mode";
import type { UAPubSubStatus } from "./ua_pub_sub_status";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubGroupType i=14232                                     |
 * |isAbstract      |true                                                        |
 */
export interface UAPubSubGroup_Base {
    securityMode: UAProperty<EnumMessageSecurityMode, DataType.Int32>;
    securityGroupId?: UAProperty<UAString, DataType.String>;
    securityKeyServices?: UAProperty<DTEndpointDescription[], DataType.ExtensionObject>;
    maxNetworkMessageSize: UAProperty<UInt32, DataType.UInt32>;
    groupProperties: UAProperty<DTKeyValuePair[], DataType.ExtensionObject>;
    status: UAPubSubStatus;
}
export interface UAPubSubGroup extends UAObject, UAPubSubGroup_Base {}