// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                                |
 * | nodeClass |DataType                                                    |
 * | name      |TransactionErrorType                                        |
 * | isAbstract|false                                                       |
 */
export interface DTTransactionError extends DTStructure {
  targetId: NodeId; // NodeId ns=0;i=17
  error: StatusCode; // StatusCode ns=0;i=19
  message: LocalizedText; // LocalizedText ns=0;i=21
}
export interface UDTTransactionError extends ExtensionObject, DTTransactionError {};