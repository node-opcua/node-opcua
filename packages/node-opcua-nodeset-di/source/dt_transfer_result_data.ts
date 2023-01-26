// ----- this file has been automatically generated - do not edit
import { Int32 } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTFetchResult } from "./dt_fetch_result"
import { DTParameterResult } from "./dt_parameter_result"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/DI/                   |
 * | nodeClass |DataType                                          |
 * | name      |1:TransferResultDataDataType                      |
 * | isAbstract|false                                             |
 */
export interface DTTransferResultData extends DTFetchResult {
  sequenceNumber: Int32; // Int32 ns=0;i=6
  endOfResults: boolean; // Boolean ns=0;i=1
  parameterDefs: DTParameterResult[]; // ExtensionObject ns=1;i=6525
}
export interface UDTTransferResultData extends ExtensionObject, DTTransferResultData {};