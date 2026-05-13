import type { DiagnosticInfo, QualifiedName } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";
import type { StatusCode } from "node-opcua-status-code";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/DI/                             |
 * | nodeClass |DataType                                                    |
 * | name      |ParameterResultDataType                                     |
 * | isAbstract|false                                                       |
 */
export interface DTParameterResult extends DTStructure {
  nodePath: QualifiedName[]; // QualifiedName ns=0;i=20
  statusCode: StatusCode; // StatusCode ns=0;i=19
  diagnostics: DiagnosticInfo; // DiagnosticInfo ns=0;i=25
}
export interface UDTParameterResult extends ExtensionObject, DTParameterResult {};