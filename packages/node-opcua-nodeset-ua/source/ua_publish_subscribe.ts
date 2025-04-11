// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt64, UInt32, UAString } from "node-opcua-basic-types"
import { DTKeyValuePair } from "./dt_key_value_pair"
import { DTEndpointDescription } from "./dt_endpoint_description"
import { UAPubSubKeyService, UAPubSubKeyService_Base } from "./ua_pub_sub_key_service"
import { UADataSetFolder } from "./ua_data_set_folder"
import { UASubscribedDataSetFolder } from "./ua_subscribed_data_set_folder"
import { UAPubSubConfiguration } from "./ua_pub_sub_configuration"
import { UAPubSubStatus } from "./ua_pub_sub_status"
import { UAPubSubDiagnosticsRoot } from "./ua_pub_sub_diagnostics_root"
import { UAPubSubCapabilities } from "./ua_pub_sub_capabilities"
import { UAFolder } from "./ua_folder"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PublishSubscribeType i=14416                                |
 * |isAbstract      |false                                                       |
 */
export interface UAPublishSubscribe_Base extends UAPubSubKeyService_Base {
   // PlaceHolder for $ConnectionName$
    setSecurityKeys?: UAMethod;
    addConnection?: UAMethod;
    removeConnection?: UAMethod;
    publishedDataSets: UADataSetFolder;
    subscribedDataSets?: UASubscribedDataSetFolder;
    pubSubConfiguration?: UAPubSubConfiguration;
    status: UAPubSubStatus;
    diagnostics?: UAPubSubDiagnosticsRoot;
    pubSubCapablities?: UAPubSubCapabilities;
    dataSetClasses?: UAFolder;
    supportedTransportProfiles: UAProperty<UAString[], DataType.String>;
    defaultDatagramPublisherId?: UAProperty<UInt64, DataType.UInt64>;
    configurationVersion?: UAProperty<UInt32, DataType.UInt32>;
    defaultSecurityKeyServices?: UAProperty<DTEndpointDescription[], DataType.ExtensionObject>;
    configurationProperties?: UAProperty<DTKeyValuePair[], DataType.ExtensionObject>;
}
export interface UAPublishSubscribe extends UAPubSubKeyService, UAPublishSubscribe_Base {
}