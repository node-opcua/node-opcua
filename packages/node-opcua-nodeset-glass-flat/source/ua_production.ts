// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UInt32 } from "node-opcua-basic-types"
import { UAProductionPlan } from "./ua_production_plan"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/           |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |13:ProductionType ns=13;i=1021                    |
 * |isAbstract      |false                                             |
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
export interface UAProduction extends UAObject, UAProduction_Base {
}