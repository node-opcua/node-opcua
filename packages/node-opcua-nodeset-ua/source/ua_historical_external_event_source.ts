// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
import { DTUserTokenPolicy } from "./dt_user_token_policy"
import { DTEventFilter } from "./dt_event_filter"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |HistoricalExternalEventSourceType i=32625                   |
 * |isAbstract      |false                                                       |
 */
export interface UAHistoricalExternalEventSource_Base {
    server?: UAProperty<UAString, DataType.String>;
    endpointUrl?: UAProperty<UAString, DataType.String>;
    securityMode?: UAProperty<EnumMessageSecurityMode, DataType.Int32>;
    securityPolicyUri?: UAProperty<UAString, DataType.String>;
    identityTokenPolicy?: UAProperty<DTUserTokenPolicy, DataType.ExtensionObject>;
    transportProfileUri?: UAProperty<UAString, DataType.String>;
    historicalEventFilter: UAProperty<DTEventFilter, DataType.ExtensionObject>;
}
export interface UAHistoricalExternalEventSource extends UAObject, UAHistoricalExternalEventSource_Base {
}