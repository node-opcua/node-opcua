// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTPublishedVariable } from "./dt_published_variable"
import { DTArgument } from "./dt_argument"
import { UAPublishedDataSet, UAPublishedDataSet_Base } from "./ua_published_data_set"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |PublishedDataItemsType ns=0;i=14534               |
 * |isAbstract      |false                                             |
 */
export interface UAPublishedDataItems_Base extends UAPublishedDataSet_Base {
    publishedData: UAProperty<DTPublishedVariable[], /*z*/DataType.ExtensionObject>;
    addVariables?: UAMethod;
    removeVariables?: UAMethod;
}
export interface UAPublishedDataItems extends UAPublishedDataSet, UAPublishedDataItems_Base {
}