// ----- this file has been automatically generated - do not edit
import { Int32 } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTResultId } from "./dt_result_id"
import { DTMeasId } from "./dt_meas_id"
import { DTPartId } from "./dt_part_id"
import { DTRecipeIdExternal } from "./dt_recipe_id_external"
import { DTRecipeIdInternal } from "./dt_recipe_id_internal"
import { DTProductId } from "./dt_product_id"
import { DTConfigurationId } from "./dt_configuration_id"
import { DTJobId } from "./dt_job_id"
import { DTProcessingTimes } from "./dt_processing_times"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:ResultDataType                                  |
 * | isAbstract|false                                             |
 */
export interface DTResult extends DTStructure  {
/** System-wide unique identifier, which is assigned by the system. This ID can be used for fetching exactly this result using the pertinent result management methods and it is identical to the ResultId of the ResultReadyEventType.*/
  resultId: DTResultId; // ExtensionObject ns=4;i=3021
/** Indicates that additional data for this result can be retrieved by temporary file transfer.*/
  hasTransferableDataOnFile: boolean; // Boolean ns=0;i=1
/** Indicates whether the result is the partial result of a total result.*/
  isPartial: boolean; // Boolean ns=0;i=1
/** Indicates whether the system was in simulation mode when the result was created.*/
  isSimulated: boolean; // Boolean ns=0;i=1
/** ResultState provides information about the current state of a result and the ResultStateDataType is defined in Section 12.18.*/
  resultState: Int32; // Int32 ns=4;i=3009
/** This identifier is given by the client when starting a single job or continuous execution and transmitted to the vision system. It is used to identify the respective result data generated for this job. Although the system-wide unique JobId would be sufficient to identify the job which the result belongs to, this makes for easier filtering on the part of the client without keeping track of JobIds.*/
  measId: DTMeasId; // ExtensionObject ns=4;i=3015
/** A PartId is given by the client when starting the job; although the system-wide unique JobId would be sufficient to identify the job which the result belongs to, this makes for easier filtering on the part of the client without keeping track of JobIds.*/
  partId: DTPartId; // ExtensionObject ns=4;i=3004
/** External Id of the recipe in use which produced the result. The ExternalID is only managed by the environment.*/
  externalRecipeId: DTRecipeIdExternal; // ExtensionObject ns=4;i=3002
/** Internal Id of the recipe in use which produced the result. This ID is system-wide unique and is assigned by the vision system.*/
  internalRecipeId: DTRecipeIdInternal; // ExtensionObject ns=4;i=3013
/** productId which was used to trigger the job which created the result.*/
  productId: DTProductId; // ExtensionObject ns=4;i=3003
/** External Id of the configuration in use which produced the result. The ExternalID is only managed by the environment.*/
  externalConfigurationId: DTConfigurationId; // ExtensionObject ns=4;i=3008
/** Internal Id of the configuration in use which produced the result. This ID is system-wide unique and is assigned by the vision system.*/
  internalConfigurationId: DTConfigurationId; // ExtensionObject ns=4;i=3008
/** The ID of the job, created by the transition from state Ready to state SingleExecution or to state ContinuousExecution which produced the result.*/
  jobId: DTJobId; // ExtensionObject ns=4;i=3016
/** CreationTime indicates the time when the result was created.*/
  creationTime: Date; // DateTime ns=0;i=294
/** Collection of different processing times that were needed to create the result.*/
  processingTimes: DTProcessingTimes; // ExtensionObject ns=4;i=3005
/** Abstract data type to be subtyped from to hold result data created by the selected recipe.*/
  resultContent: undefined[]; // Null ns=0;i=0
}