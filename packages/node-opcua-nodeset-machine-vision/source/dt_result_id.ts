// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:ResultIdDataType                                |
 * | isAbstract|false                                             |
 */
export interface DTResultId extends DTStructure {
  /** Id is a system-wide unique identifier/name for identifying the generated result.*/
  id: UAString; // String ns=4;i=3017
}
export interface UDTResultId extends ExtensionObject, DTResultId {};