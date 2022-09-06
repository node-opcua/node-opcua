// ----- this file has been automatically generated - do not edit
import { EUInformation } from "node-opcua-data-access"
import { Int32, Byte, UAString, Guid } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { EnumResultEvaluation } from "./enum_result_evaluation"
/**
 * It is used to report measurement values of the
 * joining operation.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:ResultValueDataType                            |
 * | isAbstract|false                                             |
 */
export interface DTResultValue extends DTStructure {
/** The mandatory Value is the measured value of the given result. The value corresponds to the PhysicalQuantity attribute.*/
  value: number; // Double ns=0;i=11
/** The optional Name is a user readable name of the given measurement value.*/
  name: UAString; // String ns=0;i=12
/** The optional ResultEvaluation indicates whether the measured value is as per the configured limits and corresponds to a successful result or not.*/
  resultEvaluation: EnumResultEvaluation; // Int32 ns=14;i=3008
/** The optional ValueId is the system-wide unique Identifier of the given value if it is available in the system.*/
  valueId: Guid; // Guid ns=0;i=14
/** The optional ValueTag is an associated tag to the given measurement value to classify it based on the tightening domain. Examples: FINAL, YIELD, SNUG, etc.*/
  valueTag: Byte; // Byte ns=0;i=3
/** The optional TracePointIndex is the index to the trace sample array from which corresponds to this specific result.*/
  tracePointIndex: Int32; // Int32 ns=0;i=6
/** The optional TracePointTimeOffset is the time offset (in seconds) to point out the absolute time point in the array of trace samples. This may or may not match with an element in the TraceContent array. If it is not available in the TraceContent array, the value can be visualized in the trace graph via interpolation or some other plotting mechanisms.*/
  tracePointTimeOffset: number; // Double ns=0;i=11
/** The optional ReporterId is the system-wide unique identifier of the parameter configured in the Program which is being monitored or sampled.*/
  reporterId: Guid; // Guid ns=0;i=14
/** The optional ViolationType indicates whether the measured value is above or below the configured limit. It is only relevant if program or step configuration is violated.*/
  violationType: Byte; // Byte ns=0;i=3
/** The optional ViolationConsequence provides information on the consequence occurred due to the violation of the configurable limits. Examples: Step Transition, Abort Operation. Is the consequence repairable or not, etc.*/
  violationConsequence: Byte; // Byte ns=0;i=3
/** The optional SensorId is the system-wide unique identifier of the sensor which has reported the value.*/
  sensorId: Guid; // Guid ns=0;i=14
/** The optional LowLimit provides the lower limit of the measured value as per the program.*/
  lowLimit: number; // Double ns=0;i=11
/** The optional HighLimit provides the upper limit of the measured value as per the program.*/
  highLimit: number; // Double ns=0;i=11
/** The optional TargetValue provides the target value of the specific measurement in the program step.*/
  targetValue: number; // Double ns=0;i=11
/** The optional ResultStep provides the step number or name of the program step which has generated the result.*/
  resultStep: UAString; // String ns=0;i=12
/** The optional PhysicalQuantity is to determine the type of the physical quantity associated to a given value(s).*/
  physicalQuantity: Byte; // Byte ns=0;i=3
/** The optional 0:EngineeringUnits defines the engineering unit of the value.*/
  engineeringUnits: EUInformation; // ExtensionObject ns=0;i=887
}