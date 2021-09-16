// ----- this file has been automatically generated - do not edit
import { Variant } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision         |
 * | nodeClass |DataType                                          |
 * | name      |4:SystemStateDescriptionDataType                  |
 * | isAbstract|false                                             |
 */
export interface DTSystemStateDescription extends DTStructure  {
/** Denotes one of the basic SEMI E10 states*/
  state: Variant; // Variant ns=4;i=3023
/** Optional string describing the full state path, starting with the SEMI E10 state denoted by the state member; the string format is described in Section 11.5.*/
  stateDescription: UAString; // String ns=4;i=3017
}