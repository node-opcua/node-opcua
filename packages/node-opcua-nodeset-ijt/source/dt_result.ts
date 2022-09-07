// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int32, Byte, Guid } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTProcessingTimes } from "./dt_processing_times"
import { EnumResultEvaluation } from "./enum_result_evaluation"
import { DTTag } from "./dt_tag"
/**
 * This structure contains the aggregated
 * information of the Result data represented by
 * ResultType variable.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:ResultDataType                                 |
 * | isAbstract|false                                             |
 */
export interface DTResult extends DTStructure {
  /** The mandatory ResultId is the system-wide unique identifier of the result.*/
  resultId: Guid; // Guid ns=0;i=14
  /** The optional ProcessingTimes is the collection of different processing times that were needed to create the result.*/
  processingTimes?: DTProcessingTimes; // ExtensionObject ns=14;i=3002
  /** The optional CreationTime indicates the time when the result was created.*/
  creationTime?: Date; // DateTime ns=0;i=294
  /** The optional ResultEvaluation indicates whether the joining operation was successful or not.*/
  resultEvaluation?: EnumResultEvaluation; // Int32 ns=14;i=3008
  /** The optional ResultEvaluationCode is a vendor/application specific code. It can be up to the system to define few numbers to describe Nine-field code, or derivative of the nine-field matrix, etc. 0 – OK, successful operation.*/
  resultEvaluationCode?: Int32; // Int32 ns=0;i=6
  /** The optional ResultEvaluationDetails provides high level status information in a user-friendly text. This can be left empty for successful operations.*/
  resultEvaluationDetails?: LocalizedText; // LocalizedText ns=0;i=21
  /** The optional SequenceNumber is the cyclic counter which is incremented for each result generated.*/
  sequenceNumber?: Int32; // Int32 ns=0;i=6
  /** The optional Tags is a list of identifiers associated to the given result. Examples: {VIN, XYZ1234}, {PardId, E54YJH}, {SocketNumber, 5}, etc.*/
  tags?: DTTag[]; // ExtensionObject ns=14;i=3003
  /** The optional Classification provides information on the classification of the result in the joining system.*/
  classification?: Byte; // Byte ns=0;i=3
  /** The optional OperationMode provides information on how the joining process was selected.*/
  operationMode?: Byte; // Byte ns=0;i=3
  /** The optional IsSimulated indicates whether the system was in simulation mode when the joining process created this result.*/
  isSimulated?: boolean; // Boolean ns=0;i=1
  /** The optional IsPartial indicates whether the result is the partial result of a total result. If this is true, then it indicates that result data is not complete. If the result is sent in multiple calls, then ResultId must be same for linking the complete result data.*/
  isPartial?: boolean; // Boolean ns=0;i=1
  /** The optional ReporterAssetId is the identifier of the asset which has reported the result.*/
  reporterAssetId?: Guid; // Guid ns=0;i=14
  /** The optional GeneratorAssetId is the identifier of the asset which has generated the result.*/
  generatorAssetId?: Guid; // Guid ns=0;i=14
  /** The optional ResultContent is an abstract data type to hold result data created by the selected program.*/
  resultContent?: undefined; // Null ns=0;i=0
}
export interface UDTResult extends ExtensionObject, DTResult {};