import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt32, UInt64 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { DTEndpointDescription } from "./dt_endpoint_description";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { UADataSetFolder } from "./ua_data_set_folder";
import type { UAFolder } from "./ua_folder";
import type { UAPubSubCapabilities } from "./ua_pub_sub_capabilities";
import type { UAPubSubConfiguration } from "./ua_pub_sub_configuration";
import type { UAPubSubDiagnosticsRoot } from "./ua_pub_sub_diagnostics_root";
import type { UAPubSubKeyService, UAPubSubKeyService_Base } from "./ua_pub_sub_key_service";
import type { UAPubSubStatus } from "./ua_pub_sub_status";
import type { UASubscribedDataSetFolder } from "./ua_subscribed_data_set_folder";

// ----- this file has been automatically generated - do not edit

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
export interface UAPublishSubscribe extends UAPubSubKeyService, UAPublishSubscribe_Base {}