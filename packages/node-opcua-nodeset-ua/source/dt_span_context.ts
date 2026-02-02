// ----- this file has been automatically generated - do not edit
import { UInt64, Guid } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |SpanContextDataType                                         |
 * | isAbstract|false                                                       |
 */
export interface DTSpanContext extends DTStructure {
  traceId: Guid; // Guid ns=0;i=14
  spanId: UInt64; // UInt64 ns=0;i=9
}
export interface UDTSpanContext extends ExtensionObject, DTSpanContext {};