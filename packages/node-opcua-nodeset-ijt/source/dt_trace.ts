// ----- this file has been automatically generated - do not edit
import { Guid } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * It is a base type to encapsulate common data for
 * a Trace.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/                  |
 * | nodeClass |DataType                                          |
 * | name      |14:TraceDataType                                  |
 * | isAbstract|false                                             |
 */
export interface DTTrace extends DTStructure {
/** The mandatory TraceId is the system-wide unique identifier of the Trace.*/
  traceId: Guid; // Guid ns=0;i=14
/** The mandatory ResultId is the system-wide unique identifier of the associated result. This is useful to link Result and Trace instances when the Result and Trace are sent separately.*/
  resultId: Guid; // Guid ns=0;i=14
}