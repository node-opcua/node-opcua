// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { Int32 } from "node-opcua-basic-types"
import { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/source/ua_folder"
import { DTResult } from "./dt_result"
import { DTConfigurationId } from "./dt_configuration_id"
import { DTRecipeIdExternal } from "./dt_recipe_id_external"
import { DTRecipeIdInternal } from "./dt_recipe_id_internal"
import { DTJobId } from "./dt_job_id"
import { DTMeasId } from "./dt_meas_id"
import { DTPartId } from "./dt_part_id"
import { DTProcessingTimes } from "./dt_processing_times"
import { DTProductId } from "./dt_product_id"
import { DTResultId } from "./dt_result_id"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MachineVision         |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |4:ResultFolderType ns=4;i=1016                    |
 * |isAbstract      |false                                             |
 */
export interface UAResultFolder_Base extends UAFolder_Base {
}
export interface UAResultFolder extends UAFolder, UAResultFolder_Base {
}