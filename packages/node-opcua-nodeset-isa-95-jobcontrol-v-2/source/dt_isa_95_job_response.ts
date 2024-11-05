// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
import { DTISA95State } from "./dt_isa_95_state"
import { DTISA95Parameter } from "./dt_isa_95_parameter"
import { DTISA95Personnel } from "./dt_isa_95_personnel"
import { DTISA95Equipment } from "./dt_isa_95_equipment"
import { DTISA95PhysicalAsset } from "./dt_isa_95_physical_asset"
import { DTISA95Material } from "./dt_isa_95_material"
/**
 * Defines the information needed to schedule and
 * execute a job.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/ISA95-JOBCONTROL_V2/            |
 * | nodeClass |DataType                                                    |
 * | name      |ISA95JobResponseDataType                                    |
 * | isAbstract|false                                                       |
 */
export interface DTISA95JobResponse extends DTStructure {
  /** An identification of the Job Response*/
  jobResponseID: UAString; // String ns=0;i=12
  /** Additional information about the Job Response*/
  description?: LocalizedText; // LocalizedText ns=0;i=21
  /** An identification of the job order associated with the job response.*/
  jobOrderID: UAString; // String ns=0;i=12
  /** The actual start time for the order.*/
  startTime?: Date; // DateTime ns=0;i=13
  /** The actual end time for the order.*/
  endTime?: Date; // DateTime ns=0;i=13
  /** The current state of the job. The array shall provide at least one entry representing the top level state and potentially additional entries representing substates. The first entry shall be the top level entry, having the BrowsePath set to Null. The order of the subtstates is not defined.*/
  jobState: DTISA95State[]; // ExtensionObject ns=9;i=3006
  /** Key value pair with values, not associated with a resource that is provided as part of the job response, may be empty if not specified.*/
  jobResponseData?: DTISA95Parameter[]; // ExtensionObject ns=9;i=3003
  /** A specification of any personnel requirements associated with the job response, may be empty if not specified.*/
  personnelActuals?: DTISA95Personnel[]; // ExtensionObject ns=9;i=3011
  /** A specification of any equipment requirements associated with the job response, may be empty if not specified.*/
  equipmentActuals?: DTISA95Equipment[]; // ExtensionObject ns=9;i=3005
  /** A specification of any physical asset requirements associated with the job response, may be empty if not specified.*/
  physicalAssetActuals?: DTISA95PhysicalAsset[]; // ExtensionObject ns=9;i=3012
  /** A specification of any material requirements associated with the job response, may be empty if not specified.*/
  materialActuals?: DTISA95Material[]; // ExtensionObject ns=9;i=3010
}
export interface UDTISA95JobResponse extends ExtensionObject, DTISA95JobResponse {};