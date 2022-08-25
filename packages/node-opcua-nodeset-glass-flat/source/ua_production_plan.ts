// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { UInt64, UInt16, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAOrderedList, UAOrderedList_Base } from "node-opcua-nodeset-ua/source/ua_ordered_list"
import { DTFileFormat } from "./dt_file_format"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:ProductionPlanType ns=13;i=1023                |
 * |isAbstract      |false                                             |
 */
export type UAProductionPlan_Base = UAOrderedList_Base;
export interface UAProductionPlan extends Omit<UAOrderedList, "$OrderedObject$">, UAProductionPlan_Base {
}