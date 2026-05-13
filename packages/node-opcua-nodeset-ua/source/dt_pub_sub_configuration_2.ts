import type { UInt32 } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTDataSetMeta } from "./dt_data_set_meta";
import type { DTEndpointDescription } from "./dt_endpoint_description";
import type { DTKeyValuePair } from "./dt_key_value_pair";
import type { DTPubSubConfiguration } from "./dt_pub_sub_configuration";
import type { DTPubSubConnection } from "./dt_pub_sub_connection";
import type { DTPubSubKeyPushTarget } from "./dt_pub_sub_key_push_target";
import type { DTPublishedDataSet } from "./dt_published_data_set";
import type { DTSecurityGroup } from "./dt_security_group";
import type { DTStandaloneSubscribedDataSet } from "./dt_standalone_subscribed_data_set";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |PubSubConfiguration2DataType                                |
 * | isAbstract|false                                                       |
 */
export interface DTPubSubConfiguration2 extends DTPubSubConfiguration {
  publishedDataSets: DTPublishedDataSet[]; // ExtensionObject ns=0;i=15578
  connections: DTPubSubConnection[]; // ExtensionObject ns=0;i=15617
  enabled: boolean; // Boolean ns=0;i=1
  subscribedDataSets: DTStandaloneSubscribedDataSet[]; // ExtensionObject ns=0;i=23600
  dataSetClasses: DTDataSetMeta[]; // ExtensionObject ns=0;i=14523
  defaultSecurityKeyServices: DTEndpointDescription[]; // ExtensionObject ns=0;i=312
  securityGroups: DTSecurityGroup[]; // ExtensionObject ns=0;i=23601
  pubSubKeyPushTargets: DTPubSubKeyPushTarget[]; // ExtensionObject ns=0;i=25270
  configurationVersion: UInt32; // UInt32 ns=0;i=20998
  configurationProperties: DTKeyValuePair[]; // ExtensionObject ns=0;i=14533
}
export interface UDTPubSubConfiguration2 extends ExtensionObject, DTPubSubConfiguration2 {};