import type { UAObject } from "node-opcua-address-space-base";

import type { UAProductionActiveProgram } from "./ua_production_active_program";
import type { UAProductionJobList } from "./ua_production_job_list";
import type { UAProductionStatistics } from "./ua_production_statistics";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineTool/                    |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ProductionType i=21                                         |
 * |isAbstract      |false                                                       |
 */
export interface UAProduction_Base {
    activeProgram: UAProductionActiveProgram;
    productionPlan?: UAProductionJobList;
    statistics?: UAProductionStatistics;
}
export interface UAProduction extends UAObject, UAProduction_Base {}