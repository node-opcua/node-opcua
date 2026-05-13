import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";

import type { DTBaseResultTransferOptions } from "./dt_base_result_transfer_options";

// ----- this file has been automatically generated - do not edit

/**
 * Contains information which file should be
 * provided.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Result/               |
 * | nodeClass |DataType                                                    |
 * | name      |ResultTransferOptionsDataType                               |
 * | isAbstract|false                                                       |
 */
export interface DTResultTransferOptions extends DTBaseResultTransferOptions {
  /** The Id of the result to be transferred to the Clients*/
  resultId: UAString; // String ns=0;i=31918
}
export interface UDTResultTransferOptions extends ExtensionObject, DTResultTransferOptions {};