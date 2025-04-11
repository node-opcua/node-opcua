// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int16, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
import { DTISA95WorkMaster } from "./dt_isa_95_work_master"
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
 * | name      |ISA95JobOrderDataType                                       |
 * | isAbstract|false                                                       |
 */
export interface DTISA95JobOrder extends DTStructure {
  /** An identification of the Job Order.*/
  jobOrderID: UAString; // String ns=0;i=12
  /** Addition information about the Job Order The array allows to provide descriptions in different languages.*/
  description?: LocalizedText[]; // LocalizedText ns=0;i=21
  /** Work Master associated with the job order. If multiple work masters are defined, then the execution system can select the work master based on the availability of resources.*/
  workMasterID?: DTISA95WorkMaster[]; // ExtensionObject ns=9;i=3007
  /** The proposed start time for the order, may be empty if not specified*/
  startTime?: Date; // DateTime ns=0;i=13
  /** The proposed end time for the order, may be empty if not specified*/
  endTime?: Date; // DateTime ns=0;i=13
  /** The priority of the job order, may be empty of not specified. Higher numbers have higher priority.  This type allows the Job Order clients to pick their own ranges, and the Job Order server only has to pick the highest number.*/
  priority?: Int16; // Int16 ns=0;i=4
  /** Key value pair with values, not associated with a resource that is provided as part of the job order, may be empty if not specified.*/
  jobOrderParameters?: DTISA95Parameter[]; // ExtensionObject ns=9;i=3003
  /** A specification of any personnel requirements associated with the job order, may be empty if not specified*/
  personnelRequirements?: DTISA95Personnel[]; // ExtensionObject ns=9;i=3011
  /** A specification of any equipment requirements associated with the job order, may be empty if not specified.*/
  equipmentRequirements?: DTISA95Equipment[]; // ExtensionObject ns=9;i=3005
  /** A specification of any physical asset requirements associated with the job order, may be empty if not specified.*/
  physicalAssetRequirements?: DTISA95PhysicalAsset[]; // ExtensionObject ns=9;i=3012
  /** A specification of any material requirements associated with the job order, may be empty if not specified.*/
  materialRequirements?: DTISA95Material[]; // ExtensionObject ns=9;i=3010
}
export interface UDTISA95JobOrder extends ExtensionObject, DTISA95JobOrder {};