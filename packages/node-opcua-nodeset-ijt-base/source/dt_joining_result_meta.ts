// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int64, UInt64, Int32, Byte, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTResultMeta } from "node-opcua-nodeset-machinery-result/dist/dt_result_meta"
import { DTProcessingTimes } from "node-opcua-nodeset-machinery-result/dist/dt_processing_times"
import { EnumResultEvaluationEnum } from "node-opcua-nodeset-machinery-result/dist/enum_result_evaluation_enum"
import { DTEntity } from "./dt_entity"
import { DTResultCounter } from "./dt_result_counter"
import { DTKeyValue } from "./dt_key_value"
/**
 * This structure is a subtype of
 * ResultMetaDataType. It is used to define
 * additional meta data of a Result in a joining
 * system.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |JoiningResultMetaDataType                                   |
 * | isAbstract|false                                                       |
 */
export interface DTJoiningResultMeta extends DTResultMeta {
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
  processingTimes?: DTProcessingTimes; // ExtensionObject ns=11;i=3006
  /** Path to the actual measured result, managed external to the server.*/
  resultUri?: UAString[]; // String ns=0;i=23751
  /** The ResultEvaluation indicates whether the result was in tolerance.*/
  resultEvaluation?: EnumResultEvaluationEnum; // Int32 ns=11;i=3002
  /** Vendor-specific code describing more details on resultEvaluation.*/
  resultEvaluationCode?: Int64; // Int64 ns=0;i=8
  /** The optional EvaluationDetails provides high level status information in a user-friendly text. This can be left empty for successful operations.*/
  resultEvaluationDetails?: LocalizedText; // LocalizedText ns=0;i=21
  /** The format in which the measurement results are available (e.g. QDAS, CSV, …) using the ResultTransfer Object. If multiple file formats are provided, the GenerateFileForRead of ResultTransfer should contain corresponding transferOptions, to select the file format. This specification does not define those transferOptions.*/
  fileFormat?: UAString[]; // String ns=0;i=12
  /** It is a human readable text to identify the joining technology.*/
  joiningTechnology?: LocalizedText; // LocalizedText ns=0;i=21
  /** It is the cyclic counter which is incremented for each result generated.*/
  sequenceNumber?: UInt64; // UInt64 ns=0;i=9
  /** It is the user-friendly name of the result.
Examples: Job Result, Batch Result, etc.*/
  name?: UAString; // String ns=0;i=12
  /** It is the additional information associated with the result. It can contain information on the ResultConent.*/
  description?: LocalizedText; // LocalizedText ns=0;i=21
  /** It provides information on the classification of the result in the joining system.*/
  classification?: Byte; // Byte ns=0;i=3
  /** It provides information on how the joining operation was performed.*/
  operationMode?: Byte; // Byte ns=0;i=3
  /** It provides the type of joining operation.*/
  assemblyType?: Byte; // Byte ns=0;i=3
  /** It is a list of identifiers associated to the given result. 
Examples: ProductId, VIN, SocketId, JointId, JoiningProcessId, etc.*/
  associatedEntities?: DTEntity[]; // ExtensionObject ns=18;i=3010
  /** It is a list of counters associated to the given result. 
Examples: Batch Counter, Retry Counter, Channel Counter, etc.*/
  resultCounters?: DTResultCounter[]; // ExtensionObject ns=18;i=3004
  /** It provides information on type of intervention which has occurred during the joining operation.*/
  interventionType?: Byte; // Byte ns=0;i=3
  /** It indicates that the result is generated when the asset was offline. The default value is false.
Note: The definition of offline status is application specific.
Example: Wireless tool performing joining in radio shadow.*/
  isGeneratedOffline?: boolean; // Boolean ns=0;i=1
  /** It is used to send any additional meta data which cannot be sent using the existing properties. It shall be used only for sending meta data but not any content.*/
  extendedMetaData?: DTKeyValue[]; // ExtensionObject ns=18;i=3008
}
export interface UDTJoiningResultMeta extends ExtensionObject, DTJoiningResultMeta {};