// ----- this file has been automatically generated - do not edit
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTResultId } from "./dt_result_id"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:ResultTransferOptions                           |
 * | isAbstract|false                                             |
 */
export interface DTResultTransferOptions extends DTStructure  {
/** The Id of the result to be transferred to the client.*/
  id: DTResultId; // ExtensionObject ns=4;i=3021
}