// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int64, Int32, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { DTProcessingTimes } from "./dt_processing_times"
import { EnumResultEvaluationEnum } from "./enum_result_evaluation_enum"
import { DTResult } from "./dt_result"
import { DTResultMeta } from "./dt_result_meta"
export interface UAResult_resultMetaData<T, DT extends DataType> extends UABaseDataVariable<T, DT> { // Variable
      /**
       * creationTime
       * CreationTime indicates the time when the result
       * was created. Creation time on the measurement
       * system (not the receive time of the server).
       * It is recommended to always provide the
       * creationTime.
       */
      creationTime?: UABaseDataVariable<Date, DataType.DateTime>;
      externalConfigurationId?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * externalRecipeId
       * External ID of the recipe in use which produced
       * the result. The External ID is managed by the
       * environment.
       * This specification does not define how the
       * externalRecipeId is transmitted to the system.
       * Typically, it is provided by the client.
       */
      externalRecipeId?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * fileFormat
       * The format in which the measurement results are
       * available (e.g. QDAS, CSV, …) using the
       * ResultTransfer Object. If multiple file formats
       * are provided, the GenerateFileForRead of
       * ResultTransfer should contain corresponding
       * transferOptions, to select the file format. This
       * specification does not define those
       * transferOptions.
       */
      fileFormat?: UABaseDataVariable<UAString[], DataType.String>;
      /**
       * hasTransferableDataOnFile
       * Indicates that additional data for this result
       * can be retrieved by temporary file transfer.
       * If not provided, it is assumed that no file is
       * available.
       */
      hasTransferableDataOnFile?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * internalConfigurationId
       * Internal ID of the Configuration in use while the
       * result was produced. This ID is system-wide
       * unique and it is assigned by the system.
       */
      internalConfigurationId?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * internalRecipeId
       * Internal ID of the recipe in use which produced
       * the result. This ID is system-wide unique and it
       * is assigned by the system.
       */
      internalRecipeId?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * isPartial
       * Indicates whether the result is the partial
       * result of a total result. When not all samples
       * are finished yet the result is 'partial'.
       * If not provided, it is assumed to be a total
       * result.
       */
      isPartial?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * isSimulated
       * Indicates whether the result was created in
       * simulation mode.
       * Simulation mode implies that the result is only
       * generated for testing purposes and not based on
       * real production data.
       * If not provided, it is assumed to not be
       * simulated.
       */
      isSimulated?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * jobId
       * Identifies the job which produced the result.
       * This ID is system-wide unique and it is assigned
       * by the system.
       */
      jobId?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * partId
       * Identifies the part used to produce the result.
       * Although the system-wide unique JobId would be
       * sufficient to identify the job which the result
       * belongs to, this makes for easier filtering
       * without keeping track of JobIds.
       * This specification does not define how the partId
       * is transmitted to the system. Typically, it is
       * provided by the client when starting the job.
       */
      partId?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * processingTimes
       * Collection of different processing times that
       * were needed to create the result.
       */
      processingTimes?: UABaseDataVariable<DTProcessingTimes, DataType.ExtensionObject>;
      productId?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * resultEvaluation
       * The ResultEvaluation indicates whether the result
       * was in tolerance.
       */
      resultEvaluation?: UABaseDataVariable<EnumResultEvaluationEnum, DataType.Int32>;
      /**
       * resultEvaluationCode
       * Vendor-specific code describing more details on
       * resultEvaluation.
       */
      resultEvaluationCode?: UABaseDataVariable<Int64, DataType.Int64>;
      /**
       * resultEvaluationDetails
       * The optional EvaluationDetails provides high
       * level status information in a user-friendly text.
       * This can be left empty for successful operations.
       */
      resultEvaluationDetails?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
      /**
       * resultId
       * System-wide unique identifier, which is assigned
       * by the system. This ID can be used for fetching
       * exactly this result using the method
       * GetResultById and it is identical to the ResultId
       * of the ResultReadyEventType.
       * If the system does not manage resultIds, it
       * should always be set to “NA”.
       */
      resultId: UABaseDataVariable<UAString, DataType.String>;
      /**
       * resultState
       * ResultState provides information about the
       * current state of the process or measurement
       * creating a result.
       * Applications may use negative values for
       * application-specific states. All other values
       * shall only be used as defined in the following:
       * 0 – Undefined initial value
       * 1 – Completed: Processing was carried out
       * completely
       * 2 – Processing: Processing has not been finished
       * yet
       * 3 – Aborted: Processing was stopped at some point
       * before completion
       * 4 – Failed: Processing failed in some way.
       */
      resultState?: UABaseDataVariable<Int32, DataType.Int32>;
      /**
       * resultUri
       * Path to the actual measured result, managed
       * external to the server.
       */
      resultUri?: UABaseDataVariable<UAString[], DataType.String>;
      /**
       * stepId
       * Identifies the step which produced the result.
       * Although the system-wide unique JobId would be
       * sufficient to identify the job which the result
       * belongs to, this makes for easier filtering
       * without keeping track of JobIds.
       * This specification does not define how the stepId
       * is transmitted to the system. Typically, it is
       * provided by the client when starting an execution.
       */
      stepId?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * Exposes the information of the ResultDataType in
 * individual subvariables.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/Result/               |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |ResultType i=2001                                           |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTResult i=3008                                             |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAResult_Base<T extends DTResult>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    reducedResultContent?: UABaseDataVariable<any, any>;
    resultContent?: UABaseDataVariable<any, any>;
    resultMetaData: UAResult_resultMetaData<DTResultMeta, DataType.ExtensionObject>;
}
export interface UAResult<T extends DTResult> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAResult_Base<T> {
}