import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * It is a base type to encapsulate common data for
 * a Trace.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |TraceDataType                                               |
 * | isAbstract|false                                                       |
 */
export interface DTTrace extends DTStructure {
  /** It is the system-wide unique identifier of the Trace.*/
  traceId: UAString; // String ns=0;i=31918
  /** It is the system-wide unique identifier of the associated result. This is useful to link Result and Trace instances when the Result and Trace are sent separately.*/
  resultId: UAString; // String ns=0;i=31918
}
export interface UDTTrace extends ExtensionObject, DTTrace {};