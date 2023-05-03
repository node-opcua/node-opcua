// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * Abstract type containing information which file
 * should be provided.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/Machinery/Result/               |
 * | nodeClass |DataType                                                    |
 * | name      |21:BaseResultTransferOptionsDataType                        |
 * | isAbstract|true                                                        |
 */
export interface DTBaseResultTransferOptions extends DTStructure {
  /** The Id of the result to be transferred to the Clients*/
  resultId: UAString; // String ns=0;i=31918
}
export interface UDTBaseResultTransferOptions extends ExtensionObject, DTBaseResultTransferOptions {};