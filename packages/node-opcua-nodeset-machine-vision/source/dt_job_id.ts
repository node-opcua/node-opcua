import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision                   |
 * | nodeClass |DataType                                                    |
 * | name      |JobIdDataType                                               |
 * | isAbstract|false                                                       |
 */
export interface DTJobId extends DTStructure {
  /** Id is a system-wide unique identifier/name for identifying the job carried out.*/
  id: UAString; // String ns=4;i=3017
}
export interface UDTJobId extends ExtensionObject, DTJobId {};