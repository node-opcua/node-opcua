// ----- this file has been automatically generated - do not edit
import { UInt64, UAString, Guid } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTSpanContext } from "./dt_span_context"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |TraceContextDataType                                        |
 * | isAbstract|false                                                       |
 */
export interface DTTraceContext extends DTSpanContext {
  traceId: Guid; // Guid ns=0;i=14
  spanId: UInt64; // UInt64 ns=0;i=9
  parentSpanId: UInt64; // UInt64 ns=0;i=9
  parentIdentifier: UAString; // String ns=0;i=12
}
export interface UDTTraceContext extends ExtensionObject, DTTraceContext {};