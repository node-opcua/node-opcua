import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTDataSetMeta } from "./dt_data_set_meta";
import type { UASubscribedDataSet } from "./ua_subscribed_data_set";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |StandaloneSubscribedDataSetType i=23828                     |
 * |isAbstract      |false                                                       |
 */
export interface UAStandaloneSubscribedDataSet_Base {
    subscribedDataSet: UASubscribedDataSet;
    dataSetMetaData: UAProperty<DTDataSetMeta, DataType.ExtensionObject>;
    isConnected: UAProperty<boolean, DataType.Boolean>;
}
export interface UAStandaloneSubscribedDataSet extends UAObject, UAStandaloneSubscribedDataSet_Base {}