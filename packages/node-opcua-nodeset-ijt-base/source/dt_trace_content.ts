// ----- this file has been automatically generated - do not edit
import { EUInformation } from "node-opcua-data-access"
import { Byte, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * It is to describe of the trace samples for a
 * given program step. It is used in
 * StepTraceDataType.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |TraceContentDataType                                        |
 * | isAbstract|false                                                       |
 */
export interface DTTraceContent extends DTStructure {
  /** It is an array of trace samples. The values correspond to the PhysicalQuantity attribute.*/
  values: number[]; // Double ns=0;i=11
  /** It is the system-wide unique identifier of the sensor which has reported the values. This will be useful for identifying the sensor when the same set of samples are reported by multiple sensors.*/
  sensorId?: UAString; // String ns=0;i=31918
  /** It is the user-friendly name for the given trace.*/
  name?: UAString; // String ns=0;i=12
  /** It is an additional text to describe the trace samples.*/
  description?: UAString; // String ns=0;i=12
  /** It is to determine the type of the physical quantity associated to a given value(s).*/
  physicalQuantity?: Byte; // Byte ns=0;i=3
  /** It is the engineering unit of the values.*/
  engineeringUnits?: EUInformation; // ExtensionObject ns=0;i=887
}
export interface UDTTraceContent extends ExtensionObject, DTTraceContent {};