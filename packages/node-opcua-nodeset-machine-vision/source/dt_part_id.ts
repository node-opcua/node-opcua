// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:PartIdDataType                                  |
 * | isAbstract|false                                             |
 */
export interface DTPartId extends DTStructure  {
/** Describes the connection between a unit under test and a result, which was created during the processing of a recipe applied on this unit under test. Usually passed by the client with a Start method call and not changed by the server.*/
  id: UAString; // String ns=4;i=3017
/** Optional short human readable description of the part.*/
  description: LocalizedText; // LocalizedText ns=0;i=21
}