import type { UAString, UInt16 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { NodeId } from "node-opcua-nodeid";

import type { DTNameValuePair } from "./dt_name_value_pair";
import type { DTStructure } from "./dt_structure";
import type { DTTraceContext } from "./dt_trace_context";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |LogRecord                                                   |
 * | isAbstract|false                                                       |
 */
export interface DTLogRecord extends DTStructure {
  time: Date; // DateTime ns=0;i=13
  severity: UInt16; // UInt16 ns=0;i=5
  eventType?: NodeId; // NodeId ns=0;i=17
  sourceNode?: NodeId; // NodeId ns=0;i=17
  sourceName?: UAString; // String ns=0;i=12
  message: LocalizedText; // LocalizedText ns=0;i=21
  traceContext?: DTTraceContext; // ExtensionObject ns=0;i=19747
  additionalData?: DTNameValuePair[]; // ExtensionObject ns=0;i=19748
}
export interface UDTLogRecord extends ExtensionObject, DTLogRecord {};