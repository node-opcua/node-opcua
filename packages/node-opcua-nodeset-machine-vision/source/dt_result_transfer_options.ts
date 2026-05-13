import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { DTResultId } from "./dt_result_id";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision                   |
 * | nodeClass |DataType                                                    |
 * | name      |ResultTransferOptions                                       |
 * | isAbstract|false                                                       |
 */
export interface DTResultTransferOptions extends DTStructure {
  /** The Id of the result to be transferred to the client.*/
  id: DTResultId; // ExtensionObject ns=4;i=3021
}
export interface UDTResultTransferOptions extends ExtensionObject, DTResultTransferOptions {};