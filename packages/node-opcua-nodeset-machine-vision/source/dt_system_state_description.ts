import type { UAString } from "node-opcua-basic-types";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

import type { EnumSystemState } from "./enum_system_state";

// ----- this file has been automatically generated - do not edit

/**
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/MachineVision                   |
 * | nodeClass |DataType                                                    |
 * | name      |SystemStateDescriptionDataType                              |
 * | isAbstract|false                                                       |
 */
export interface DTSystemStateDescription extends DTStructure {
  /** Denotes one of the basic SEMI E10 states*/
  state: EnumSystemState; // Int32 ns=4;i=3023
  /** Optional string describing the full state path, starting with the SEMI E10 state denoted by the state member; the string format is described in Section 11.5.*/
  stateDescription?: UAString; // String ns=4;i=3017
}
export interface UDTSystemStateDescription extends ExtensionObject, DTSystemStateDescription {};