import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * Abstract type containing information which file
 * should be provided.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Result/               |
 * | nodeClass |DataType                                                    |
 * | name      |BaseResultTransferOptionsDataType                           |
 * | isAbstract|true                                                        |
 */
export interface DTBaseResultTransferOptions extends DTStructure {
  /** The Id of the result to be transferred to the Clients*/
  resultId: UAString; // String ns=0;i=31918
}
export interface UDTBaseResultTransferOptions extends ExtensionObject, DTBaseResultTransferOptions {};