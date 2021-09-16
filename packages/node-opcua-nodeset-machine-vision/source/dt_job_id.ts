// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:JobIdDataType                                   |
 * | isAbstract|false                                             |
 */
export interface DTJobId extends DTStructure  {
/** Id is a system-wide unique identifier/name for identifying the job carried out.*/
  id: UAString; // String ns=4;i=3017
}