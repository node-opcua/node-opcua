// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UInt32, UInt16, UAString } from "node-opcua-basic-types"
import { UAOrderedList, UAOrderedList_Base } from "node-opcua-nodeset-ua/source/ua_ordered_list"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionJobListType ns=10;i=30               |
 * |isAbstract      |false                                             |
 */
export interface UAProductionJobList_Base extends UAOrderedList_Base {
}
export interface UAProductionJobList extends Omit<UAOrderedList, "$OrderedObject$">, UAProductionJobList_Base {
}