// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int64, Int32, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTProcessingTimes } from "./dt_processing_times"
import { EnumResultEvaluationEnum } from "./enum_result_evaluation_enum"
/**
 * Meta data of a result, describing the result.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Result/     |
 * | nodeClass |DataType                                          |
 * | name      |22:ResultMetaDataType                             |
 * | isAbstract|false                                             |
 */
export interface DTResultMeta extends DTStructure {
  /** System-wide unique identifier, which is assigned by the system. This ID can be used for fetching exactly this result using the method GetResultById and it is identical to the ResultId of the ResultReadyEventType.
If the system does not manage resultIds, it should always be set to “NA”.*/
  resultId: UAString; // String ns=0;i=31918
  /** Indicates that additional data for this result can be retrieved by temporary file transfer.
If not provided, it is assumed that no file is available.*/
  hasTransferableDataOnFile?: boolean; // Boolean ns=0;i=1
  /** Indicates whether the result is the partial result of a total result. When not all samples are finished yet the result is 'partial'.
If not provided, it is assumed to be a total result.*/
  isPartial?: boolean; // Boolean ns=0;i=1
  /** Indicates whether the result was created in simulation mode.
Simulation mode implies that the result is only generated for testing purposes and not based on real production data.
If not provided, it is assumed to not be simulated.*/
  isSimulated?: boolean; // Boolean ns=0;i=1
  /** ResultState provides information about the current state of the process or measurement creating a result.
Applications may use negative values for application-specific states. All other values shall only be used as defined in the following:
0 – Undefined initial value
1 – Completed: Processing was carried out completely
2 – Processing: Processing has not been finished yet
3 – Aborted: Processing was stopped at some point before completion
4 – Failed: Processing failed in some way*/
  resultState?: Int32; // Int32 ns=0;i=6
  /** Identifies the step which produced the result.
Although the system-wide unique JobId would be sufficient to identify the job which the result belongs to, this makes for easier filtering without keeping track of JobIds.
This specification does not define how the stepId is transmitted to the system. Typically, it is provided by the client when starting an execution.*/
  stepId?: UAString; // String ns=0;i=31918
  /** Identifies the part used to produce the result.
Although the system-wide unique JobId would be sufficient to identify the job which the result belongs to, this makes for easier filtering without keeping track of JobIds.
This specification does not define how the partId is transmitted to the system. Typically, it is provided by the client when starting the job.*/
  partId?: UAString; // String ns=0;i=31918
  /** External ID of the recipe in use which produced the result. The External ID is managed by the environment.
This specification does not define how the externalRecipeId is transmitted to the system. Typically, it is provided by the client.*/
  externalRecipeId?: UAString; // String ns=0;i=31918
  /** Internal ID of the recipe in use which produced the result. This ID is system-wide unique and it is assigned by the system.*/
  internalRecipeId?: UAString; // String ns=0;i=31918
  /** Identifies the product used to produce the result.
This specification does not define how the externalRecipeId is transmitted to the system. Typically, it is provided by the client.*/
  productId?: UAString; // String ns=0;i=31918
  /** External ID of the Configuration in use while the result was produced.
It is managed by the Environment.
This specification does not define how the externalConfigurationId is transmitted to the system. Typically, it is provided by the client.*/
  externalConfigurationId?: UAString; // String ns=0;i=31918
  /** Internal ID of the Configuration in use while the result was produced. This ID is system-wide unique and it is assigned by the system.*/
  internalConfigurationId?: UAString; // String ns=0;i=31918
  /** Identifies the job which produced the result.
This ID is system-wide unique and it is assigned by the system.*/
  jobId?: UAString; // String ns=0;i=31918
  /** CreationTime indicates the time when the result was created. Creation time on the measurement system (not the receive time of the server).
It is recommended to always provide the creationTime.*/
  creationTime?: Date; // DateTime ns=0;i=294
  /** Collection of different processing times that were needed to create the result.*/
  processingTimes?: DTProcessingTimes; // ExtensionObject ns=22;i=3006
  /** Path to the actual measured result, managed external to the server.*/
  resultUri?: UAString[]; // String ns=0;i=23751
  /** The ResultEvaluation indicates whether the result was in tolerance.*/
  resultEvaluation?: EnumResultEvaluationEnum; // Int32 ns=22;i=3002
  /** Vendor-specific code describing more details on resultEvaluation.*/
  resultEvaluationCode?: Int64; // Int64 ns=0;i=8
  /** The optional EvaluationDetails provides high level status information in a user-friendly text. This can be left empty for successful operations.*/
  resultEvaluationDetails?: LocalizedText; // LocalizedText ns=0;i=21
  /** The format in which the measurement results are available (e.g. QDAS, CSV, …) using the ResultTransfer Object. If multiple file formats are provided, the GenerateFileForRead of ResultTransfer should contain corresponding transferOptions, to select the file format. This specification does not define those transferOptions.*/
  fileFormat?: UAString[]; // String ns=0;i=12
}
export interface UDTResultMeta extends ExtensionObject, DTResultMeta {};