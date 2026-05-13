import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTPublishedVariable } from "./dt_published_variable";
import type { UAPublishedDataSet, UAPublishedDataSet_Base } from "./ua_published_data_set";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PublishedDataItemsType i=14534                              |
 * |isAbstract      |false                                                       |
 */
export interface UAPublishedDataItems_Base extends UAPublishedDataSet_Base {
    publishedData: UAProperty<DTPublishedVariable[], DataType.ExtensionObject>;
    addVariables?: UAMethod;
    removeVariables?: UAMethod;
}
export interface UAPublishedDataItems extends UAPublishedDataSet, UAPublishedDataItems_Base {}