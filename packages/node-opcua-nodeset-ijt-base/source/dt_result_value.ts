// ----- this file has been automatically generated - do not edit
import { EUInformation } from "node-opcua-data-access"
import { Int32, Int16, Byte, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
import { EnumResultEvaluationEnum } from "node-opcua-nodeset-machinery-result/dist/enum_result_evaluation_enum"
/**
 * It is used to report measurement values of the
 * joining operation. Those are meant to
 * characterize the quality of the process. It is
 * used in JoiningResultDataType and
 * StepResultDataType.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |ResultValueDataType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTResultValue extends DTStructure {
  /** It is the measured value of the given result. The value corresponds to the PhysicalQuantity attribute of JoiningDataVariableType.*/
  measuredValue: number; // Double ns=0;i=11
  /** It is a user readable name of the given measurement value.*/
  name?: UAString; // String ns=0;i=12
  /** It indicates whether the measured value is as per the configured limits and corresponds to a successful result or not.*/
  resultEvaluation?: EnumResultEvaluationEnum; // Int32 ns=11;i=3002
  /** It is the identifier of the given value if it is available in the system.*/
  valueId?: UAString; // String ns=0;i=31918
  /** It is an associated tag to the given measurement value to classify it based on the joining domain. Examples: FINAL, YIELD, SNUG, etc.*/
  valueTag?: Int16; // Int16 ns=0;i=4
  /** It is the index to the trace sample array from which corresponds to this specific result.*/
  tracePointIndex?: Int32; // Int32 ns=0;i=6
  /** It is the time offset to point out the absolute time point in the array of trace samples. This may or may not match with an element in the TraceContent array. If it is not available in the TraceContent array, the value can be visualized in the trace graph via interpolation or some other plotting mechanisms.*/
  tracePointTimeOffset?: number; // Double ns=0;i=290
  /** It is an array of parameter identifiers configured in the Program which is being monitored or sampled.
Note: In most common cases, it can be a single identifier.*/
  parameterIdList?: UAString[]; // String ns=0;i=31918
  /** Indicates whether the measured value is above or below  the configured limit. It is only relevant if program or step configuration is violated.*/
  violationType?: Byte; // Byte ns=0;i=3
  /** It provides information on the consequence occurred due to the violation of the configurable limits. Examples: Step Transition, Abort Joining Operation. Is the consequence repairable or not, etc.*/
  violationConsequence?: Byte; // Byte ns=0;i=3
  /** It is the system-wide unique identifier of the sensor which has reported the value.*/
  sensorId?: UAString; // String ns=0;i=31918
  /** It provides the lower limit of the measured value as per the program.*/
  lowLimit?: number; // Double ns=0;i=11
  /** It provides the upper limit of the measured value as per the program.*/
  highLimit?: number; // Double ns=0;i=11
  /** It provides the target value of the specific measurement in the program step.*/
  targetValue?: number; // Double ns=0;i=11
  /** It provides the step number or name of the program step which has generated the result. 
Note: This is not applicable for StepResultValues in StepResultDataType. This is added for OverallResultValues in JoiningResultDataType to get the information of the step which has reported the specific value.*/
  resultStep?: UAString; // String ns=0;i=12
  /** It is to determine the type of the physical quantity associated to a given value(s).*/
  physicalQuantity?: Byte; // Byte ns=0;i=3
  /** It is the engineering unit of the measured value.*/
  engineeringUnits?: EUInformation; // ExtensionObject ns=0;i=887
}
export interface UDTResultValue extends ExtensionObject, DTResultValue {};