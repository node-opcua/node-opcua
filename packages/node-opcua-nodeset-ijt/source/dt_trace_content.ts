// ----- this file has been automatically generated - do not edit
import { EUInformation } from "node-opcua-data-access"
import { Byte, UAString, Guid } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * It is to describe of the trace samples for a
 * given program step.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:TraceContentDataType                           |
 * | isAbstract|false                                             |
 */
export interface DTTraceContent extends DTStructure {
/** The mandatory Values is an array of trace samples. The values correspond to the PhysicalQuantity attribute.*/
  values: number[]; // Double ns=0;i=11
/** The optional SensorId is the system-wide unique identifier of the sensor which has reported the values. This will be useful for identifying the sensor when the same set of samples are reported by multiple sensors.*/
  sensorId: Guid; // Guid ns=0;i=14
/** The optional Name is the user readable name for the given trace.*/
  name: UAString; // String ns=0;i=12
/** The optional Description is an additional text to describe the trace samples.*/
  description: UAString; // String ns=0;i=12
/** The optional PhysicalQuantity is to determine the type of the physical quantity associated to a given value(s).*/
  physicalQuantity: Byte; // Byte ns=0;i=3
/** The optional 0:EngineeringUnits defines the engineering unit of the values.*/
  engineeringUnits: EUInformation; // ExtensionObject ns=0;i=887
}