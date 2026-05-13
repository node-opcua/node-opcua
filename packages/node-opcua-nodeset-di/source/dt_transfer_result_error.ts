import type { Int32 } from "node-opcua-basic-types";
import type { DiagnosticInfo } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTFetchResult } from "./dt_fetch_result";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/DI/                             |
 * | nodeClass |DataType                                                    |
 * | name      |TransferResultErrorDataType                                 |
 * | isAbstract|false                                                       |
 */
export interface DTTransferResultError extends DTFetchResult {
  status: Int32; // Int32 ns=0;i=6
  diagnostics: DiagnosticInfo; // DiagnosticInfo ns=0;i=25
}
export interface UDTTransferResultError extends ExtensionObject, DTTransferResultError {};