import type { UAObject } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionStatisticsType i=20                               |
 * |isAbstract      |false                                                       |
 */
export interface UAProductionStatistics_Base {
    partsProducedInLifetime?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
export interface UAProductionStatistics extends UAObject, UAProductionStatistics_Base {}