import type { UInt32 } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import type { DTRelativePath } from "node-opcua-nodeset-ua/dist/dt_relative_path";
import type { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure";

// ----- this file has been automatically generated - do not edit

/**
 * Defines the information needed to schedule and
 * execute a job.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * | nodeClass |DataType                                                    |
 * | name      |ISA95StateDataType                                          |
 * | isAbstract|false                                                       |
 */
export interface DTISA95State extends DTStructure {
  /** The browse path of substates. Shall be null when the top-level state is represented.*/
  browsePath: DTRelativePath; // ExtensionObject ns=0;i=540
  /** The state represented as human readable text. Shall represent the same text as the CurrentState Variable of a StateMachine would.*/
  stateText: LocalizedText; // LocalizedText ns=0;i=21
  /** The state represented as number. Shall represent the same number as the Number subvariable of the CurrentState Variable of a StateMachine would.*/
  stateNumber: UInt32; // UInt32 ns=0;i=7
}
export interface UDTISA95State extends ExtensionObject, DTISA95State {};