import type { UAMethod, UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { UAProductionPlan } from "./ua_production_plan";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionType i=1021                                       |
 * |isAbstract      |false                                                       |
 */
export interface UAProduction_Base {
    changePositionInList?: UAMethod;
    currentCountOfJobs?: UAProperty<UInt32, DataType.UInt32>;
    deleteJob?: UAMethod;
    insertJob?: UAMethod;
    jobListIsRecommendation: UAProperty<boolean, DataType.Boolean>;
    maxCountOfJobs?: UAProperty<UInt32, DataType.UInt32>;
    productionPlan: UAProductionPlan;
    supportedMaterialTypes?: UAProperty<NodeId[], DataType.NodeId>;
}
export interface UAProduction extends UAObject, UAProduction_Base {}