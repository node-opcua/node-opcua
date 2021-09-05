// ----- this file has been automatically generated - do not edit
import { DiagnosticInfo } from "node-opcua-data-model"
import { StatusCode } from "node-opcua-status-code"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |StatusResult                                      |
 * | isAbstract|false                                             |
 */
export interface DTStatusResult extends DTStructure  {
  statusCode: StatusCode; // StatusCode ns=0;i=19
  diagnosticInfo: DiagnosticInfo; // DiagnosticInfo ns=0;i=25
}