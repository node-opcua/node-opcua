// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
import { DTISA95Parameter } from "./dt_isa_95_parameter"
/**
 * Defines a Work Master ID and the defined
 * parameters for the Work Master.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * | nodeClass |DataType                                                    |
 * | name      |ISA95WorkMasterDataType                                     |
 * | isAbstract|false                                                       |
 */
export interface DTISA95WorkMaster extends DTStructure {
  /** An identification of the Work Master.*/
  ID: UAString; // String ns=0;i=12
  /** Additional information and description about the Work Master.*/
  description?: LocalizedText; // LocalizedText ns=0;i=21
  /** Defined parameters for the Work Master.*/
  parameters?: DTISA95Parameter[]; // ExtensionObject ns=9;i=3003
}
export interface UDTISA95WorkMaster extends ExtensionObject, DTISA95WorkMaster {};