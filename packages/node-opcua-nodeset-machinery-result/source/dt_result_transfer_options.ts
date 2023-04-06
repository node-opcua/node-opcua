// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTBaseResultTransferOptions } from "./dt_base_result_transfer_options"
/**
 * Contains information which file should be
 * provided.
 *
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Result/     |
 * | nodeClass |DataType                                          |
 * | name      |22:ResultTransferOptionsDataType                  |
 * | isAbstract|false                                             |
 */
export interface DTResultTransferOptions extends DTBaseResultTransferOptions {
  /** The Id of the result to be transferred to the Clients*/
  resultId: UAString; // String ns=0;i=31918
}
export interface UDTResultTransferOptions extends ExtensionObject, DTResultTransferOptions {};