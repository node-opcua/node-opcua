// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { UAProductionActiveProgram } from "./ua_production_active_program"
import { UAProductionJobList } from "./ua_production_job_list"
import { UAProductionStatistics } from "./ua_production_statistics"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/          |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |10:ProductionType ns=10;i=21                      |
 * |isAbstract      |false                                             |
 */
export interface UAProduction_Base {
    activeProgram: UAProductionActiveProgram;
    productionPlan?: UAProductionJobList;
    statistics?: UAProductionStatistics;
}
export interface UAProduction extends UAObject, UAProduction_Base {
}