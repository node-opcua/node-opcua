// ----- this file has been automatically generated - do not edit
import { UInt32 } from "node-opcua-basic-types"
import { DTPubSubConfiguration } from "./dt_pub_sub_configuration"
import { DTPublishedDataSet } from "./dt_published_data_set"
import { DTPubSubConnection } from "./dt_pub_sub_connection"
import { DTStandaloneSubscribedDataSet } from "./dt_standalone_subscribed_data_set"
import { DTDataSetMeta } from "./dt_data_set_meta"
import { DTEndpointDescription } from "./dt_endpoint_description"
import { DTSecurityGroup } from "./dt_security_group"
import { DTPubSubKeyPushTarget } from "./dt_pub_sub_key_push_target"
import { DTKeyValuePair } from "./dt_key_value_pair"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |PubSubConfiguration2DataType                      |
 * | isAbstract|false                                             |
 */
export interface DTPubSubConfiguration2 extends DTPubSubConfiguration  {
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