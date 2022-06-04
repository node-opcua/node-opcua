// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UASubscribedDataSet } from "./ua_subscribed_data_set"
import { DTDataSetMeta } from "./dt_data_set_meta"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |StandaloneSubscribedDataSetType ns=0;i=23828      |
 * |isAbstract      |false                                             |
 */
export interface UAStandaloneSubscribedDataSet_Base {
    subscribedDataSet: UASubscribedDataSet;
    dataSetMetaData: UAProperty<DTDataSetMeta, /*z*/DataType.ExtensionObject>;
    isConnected: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UAStandaloneSubscribedDataSet extends UAObject, UAStandaloneSubscribedDataSet_Base {
}