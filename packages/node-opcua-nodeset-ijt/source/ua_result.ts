// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32, Byte, Guid } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTResult } from "./dt_result"
import { DTProcessingTimes } from "./dt_processing_times"
import { EnumResultEvaluation } from "./enum_result_evaluation"
import { DTTag } from "./dt_tag"
/**
 * It aggregates the properties of Result data which
 * are reported for a given joining system.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |14:ResultType ns=14;i=2001                        |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTResult ns=14;i=3004                             |
 * |isAbstract      |false                                             |
 */
export interface UAResult_Base<T extends DTResult>  extends UABaseDataVariable_Base<T, DataType.ExtensionObject> {
    /**
     * classification
     * The optional Classification provides information
     * on the classification of the result in the
     * joining system.
     */
    classification?: UABaseDataVariable<Byte, DataType.Byte>;
    /**
     * creationTime
     * The optional CreationTime indicates the time when
     * the result was created.
     */
    creationTime?: UABaseDataVariable<Date, DataType.DateTime>;
    /**
     * generatorAssetId
     * The optional GeneratorAssetId is the identifier
     * of the asset which has generated the result.
     */
    generatorAssetId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * isPartial
     * The optional IsPartial indicates whether the
     * result is the partial result of a total result.
     * If this is true, then it indicates that result
     * data is not complete. If the result is sent in
     * multiple calls, then ResultId must be same for
     * linking the complete result data.
     */
    isPartial?: UABaseDataVariable<boolean, DataType.Boolean>;
    /**
     * isSimulated
     * The optional IsSimulated indicates whether the
     * system was in simulation mode when the joining
     * process created this result.
     */
    isSimulated?: UABaseDataVariable<boolean, DataType.Boolean>;
    /**
     * operationMode
     * The optional OperationMode provides information
     * on how the joining process was selected.
     */
    operationMode?: UABaseDataVariable<Byte, DataType.Byte>;
    /**
     * processingTimes
     * The optional ProcessingTimes is the collection of
     * different processing times that were needed to
     * create the result.
     */
    processingTimes?: UABaseDataVariable<DTProcessingTimes, DataType.ExtensionObject>;
    /**
     * reporterAssetId
     * The optional ReporterAssetId is the identifier of
     * the asset which has reported the result.
     */
    reporterAssetId?: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * resultContent
     * The  optional ResultContent is an abstract data
     * type to hold result data created by the selected
     * program.
     */
    resultContent?: UABaseDataVariable<any, any>;
    /**
     * resultEvaluation
     * The optional ResultEvaluation indicates whether
     * the joining operation was successful or not.
     */
    resultEvaluation?: UABaseDataVariable<EnumResultEvaluation, DataType.Int32>;
    /**
     * resultEvaluationCode
     * The optional ResultEvaluationCode is a
     * vendor/application specific code. It can be up to
     * the system to define few numbers to describe
     * Nine-field code, or derivative of the nine-field
     * matrix, etc. 0 – OK, successful operation.
     */
    resultEvaluationCode?: UABaseDataVariable<Int32, DataType.Int32>;
    /**
     * resultEvaluationDetails
     * The optional ResultEvaluationDetails provides
     * high level evaluation information in a
     * user-friendly text. This can be left empty for
     * successful operations.
     */
    resultEvaluationDetails?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    /**
     * resultId
     * The mandatory ResultId is the system-wide unique
     * identifier of the result.
     */
    resultId: UABaseDataVariable<Guid, DataType.Guid>;
    /**
     * sequenceNumber
     * The optional SequenceNumber is the cyclic counter
     * which is incremented for each result generated.
     */
    sequenceNumber?: UABaseDataVariable<Int32, DataType.Int32>;
    /**
     * tags
     * The optional Tags is a list of identifiers
     * associated to the given result. Examples: {VIN,
     * XYZ1234}, {PartId, E54YJH}, {SocketNumber, 5},
     * etc.
     */
    tags?: UABaseDataVariable<DTTag[], DataType.ExtensionObject>;
}
export interface UAResult<T extends DTResult> extends UABaseDataVariable<T, DataType.ExtensionObject>, UAResult_Base<T> {
}