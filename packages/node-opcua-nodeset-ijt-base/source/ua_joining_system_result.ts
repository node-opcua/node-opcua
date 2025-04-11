// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int64, Byte, UAString } from "node-opcua-basic-types"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAResult_resultMetaData, UAResult, UAResult_Base } from "node-opcua-nodeset-machinery-result/dist/ua_result"
import { DTResult } from "node-opcua-nodeset-machinery-result/dist/dt_result"
import { DTEntity } from "./dt_entity"
import { DTKeyValue } from "./dt_key_value"
import { DTResultCounter } from "./dt_result_counter"
import { DTJoiningResultMeta } from "./dt_joining_result_meta"
export interface UAJoiningSystemResult_resultMetaData<T, DT extends DataType> extends UAResult_resultMetaData<T, DT> { // Variable
      /**
       * assemblyType
       * It provides the type of joining operation.
       */
      assemblyType?: UABaseDataVariable<Byte, DataType.Byte>;
      /**
       * associatedEntities
       * It is a list of identifiers associated to the
       * given result. 
       * Examples: ProductId, VIN, SocketId, JointId,
       * JoiningProcessId, etc.
       */
      associatedEntities?: UABaseDataVariable<DTEntity[], DataType.ExtensionObject>;
      /**
       * classification
       * It provides information on the classification of
       * the result in the joining system.
       */
      classification?: UABaseDataVariable<Byte, DataType.Byte>;
      /**
       * $description
       * It is the additional information associated with
       * the result. It can contain information on the
       * ResultConent.
       */
      "$description"?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
      /**
       * extendedMetaData
       * It is used to send any additional meta data which
       * cannot be sent using the existing properties. It
       * shall be used only for sending meta data but not
       * any content.
       */
      extendedMetaData?: UABaseDataVariable<DTKeyValue[], DataType.ExtensionObject>;
      /**
       * interventionType
       * It provides information on type of intervention
       * which has occurred during the joining operation.
       */
      interventionType?: UABaseDataVariable<Byte, DataType.Byte>;
      /**
       * isGeneratedOffline
       * It indicates that the result is generated when
       * the asset was offline. The default value is
       * false.
       * Note: The definition of offline status is
       * application specific.
       * Example: Wireless tool performing joining in
       * radio shadow.
       */
      isGeneratedOffline?: UABaseDataVariable<boolean, DataType.Boolean>;
      /**
       * joiningTechnology
       * It is a human readable text to identify the
       * joining technology.
       */
      joiningTechnology?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
      /**
       * name
       * It is the user-friendly name of the result.
       */
      name?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * operationMode
       * It provides information on how the joining
       * operation was performed.
       */
      operationMode?: UABaseDataVariable<Byte, DataType.Byte>;
      /**
       * resultCounters
       * It is a list of counters associated to the given
       * result. 
       * Examples: Batch Counter, Retry Counter, Channel
       * Counter, etc.
       */
      resultCounters?: UABaseDataVariable<DTResultCounter[], DataType.ExtensionObject>;
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
       * sequenceNumber
       * It is a human readable text to identify the
       * joining technology.
       */
      sequenceNumber?: UABaseDataVariable<Int64, DataType.Int64>;
}
/**
 * The JoiningSystemResultType is a subtype of
 * ResultType. It is used to expose the information
 * of the ResultDataType in individual sub-variables.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |JoiningSystemResultType i=2014                              |
 * |dataType        |ExtensionObject                                             |
 * |dataType Name   |DTResult i=3008                                             |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAJoiningSystemResult_Base<T extends DTResult>  extends UAResult_Base<T> {
    resultContent?: UABaseDataVariable<any, any>;
    resultMetaData: UAJoiningSystemResult_resultMetaData<DTJoiningResultMeta, DataType.ExtensionObject>;
}
export interface UAJoiningSystemResult<T extends DTResult> extends Omit<UAResult<T>, "resultContent"|"resultMetaData">, UAJoiningSystemResult_Base<T> {
}