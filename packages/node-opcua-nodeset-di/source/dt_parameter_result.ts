// ----- this file has been automatically generated - do not edit
import { QualifiedName, DiagnosticInfo } from "node-opcua-data-model"
import { StatusCode } from "node-opcua-status-code"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/DI/                   |
 * | nodeClass |DataType                                          |
 * | name      |1:ParameterResultDataType                         |
 * | isAbstract|false                                             |
 */
export interface DTParameterResult extends DTStructure {
  nodePath: QualifiedName[]; // QualifiedName ns=0;i=20
  statusCode: StatusCode; // StatusCode ns=0;i=19
  diagnostics: DiagnosticInfo; // DiagnosticInfo ns=0;i=25
}
export interface UDTParameterResult extends ExtensionObject, DTParameterResult {};