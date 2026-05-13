import type { DiagnosticInfo } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { StatusCode } from "node-opcua-status-code";

import type { DTStructure } from "./dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |StatusResult                                                |
 * | isAbstract|false                                                       |
 */
export interface DTStatusResult extends DTStructure {
  statusCode: StatusCode; // StatusCode ns=0;i=19
  diagnosticInfo: DiagnosticInfo; // DiagnosticInfo ns=0;i=25
}
export interface UDTStatusResult extends ExtensionObject, DTStatusResult {};