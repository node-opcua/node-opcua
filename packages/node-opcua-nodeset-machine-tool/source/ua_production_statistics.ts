// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionStatisticsType ns=10;i=20            |
 * |isAbstract      |false                                             |
 */
export interface UAProductionStatistics_Base {
    partsProducedInLifetime?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
}
export interface UAProductionStatistics extends UAObject, UAProductionStatistics_Base {
}