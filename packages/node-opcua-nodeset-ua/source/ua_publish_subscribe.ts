// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, UInt16, Byte, UAString } from "node-opcua-basic-types"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { EnumMessageSecurityMode } from "./enum_message_security_mode"
import { DTEndpointDescription } from "./dt_endpoint_description"
import { EnumPubSubState } from "./enum_pub_sub_state"
import { EnumDiagnosticsLevel } from "./enum_diagnostics_level"
import { EnumPubSubDiagnosticsCounterClassification } from "./enum_pub_sub_diagnostics_counter_classification"
import { DTArgument } from "./dt_argument"
import { DTDataSetMeta } from "./dt_data_set_meta"
import { UAPubSubKeyService, UAPubSubKeyService_Base } from "./ua_pub_sub_key_service"
import { UADataSetFolder } from "./ua_data_set_folder"
import { UAPubSubStatus } from "./ua_pub_sub_status"
import { UAPubSubDiagnosticsRoot } from "./ua_pub_sub_diagnostics_root"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PublishSubscribeType ns=0;i=14416                 |
 * |isAbstract      |false                                             |
 */
export interface UAPublishSubscribe_Base extends UAPubSubKeyService_Base {
    setSecurityKeys?: UAMethod;
    addConnection?: UAMethod;
    removeConnection?: UAMethod;
    publishedDataSets: UADataSetFolder;
    status: UAPubSubStatus;
    diagnostics?: UAPubSubDiagnosticsRoot;
    supportedTransportProfiles: UAProperty<UAString[], /*z*/DataType.String>;
}
export interface UAPublishSubscribe extends UAPubSubKeyService, UAPublishSubscribe_Base {
}