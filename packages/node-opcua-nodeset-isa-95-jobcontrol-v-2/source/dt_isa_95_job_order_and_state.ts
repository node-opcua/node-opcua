// ----- this file has been automatically generated - do not edit
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
import { DTISA95JobOrder } from "./dt_isa_95_job_order"
import { DTISA95State } from "./dt_isa_95_state"
/**
 * Defines the information needed to schedule and
 * execute a job.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * | nodeClass |DataType                                                    |
 * | name      |ISA95JobOrderAndStateDataType                               |
 * | isAbstract|false                                                       |
 */
export interface DTISA95JobOrderAndState extends DTStructure {
  /** The job order*/
  jobOrder: DTISA95JobOrder; // ExtensionObject ns=9;i=3008
  /** The State of the job order. The array shall provide at least one entry representing the top level state and potentially additional entries representing substates. The first entry shall be the top level entry, having the BrowsePath set to Null. The order of the subtstates is not defined.*/
  state: DTISA95State[]; // ExtensionObject ns=9;i=3006
}
export interface UDTISA95JobOrderAndState extends ExtensionObject, DTISA95JobOrderAndState {};