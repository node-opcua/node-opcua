// ----- this file has been automatically generated - do not edit
import { DiagnosticInfo } from "node-opcua-data-model"
import { Int32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTFetchResult } from "./dt_fetch_result"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/DI/                   |
 * | nodeClass |DataType                                          |
 * | name      |1:TransferResultErrorDataType                     |
 * | isAbstract|false                                             |
 */
export interface DTTransferResultError extends DTFetchResult {
  status: Int32; // Int32 ns=0;i=6
  diagnostics: DiagnosticInfo; // DiagnosticInfo ns=0;i=25
}
export interface UDTTransferResultError extends ExtensionObject, DTTransferResultError {};