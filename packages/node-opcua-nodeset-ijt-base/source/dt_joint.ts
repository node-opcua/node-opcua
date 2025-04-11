// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int16, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
import { DTEntity } from "./dt_entity"
/**
 * This structure provides the joint information.
 * Joint is the physical outcome of the joining
 * operation which determines the properties of the
 * point where multiple parts are assembled.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |JointDataType                                               |
 * | isAbstract|false                                                       |
 */
export interface DTJoint extends DTStructure {
  /** It is the identifier of the joint.*/
  jointId: UAString; // String ns=0;i=31918
  /** It is an identifier to track the changes made to the original instance in the system.

Example: It can point to the identifier of the object when it was created for the first time. It should be an existing ID in the system if it is available else it can be NULL if it is not tracked in a joining system.*/
  jointOriginId?: UAString; // String ns=0;i=31918
  /** It is the identifier of the associated joint design.*/
  jointDesignId?: UAString; // String ns=0;i=31918
  /** It is the time when the joint was created.*/
  creationTime?: Date; // DateTime ns=0;i=294
  /** It is the time when the joint was updated last time. If it is not available, it can be same as CreationTime.*/
  lastUpdatedTime?: Date; // DateTime ns=0;i=294
  /** It is the name of the joint.*/
  name?: UAString; // String ns=0;i=12
  /** It is the description of the joint.*/
  description?: LocalizedText; // LocalizedText ns=0;i=21
  /** It is the classification of the joint.*/
  classification?: Int16; // Int16 ns=0;i=4
  /** It is the details of the classification. It can also be used to provide any other type of classification.

Examples: Safety Critical, etc.*/
  classificationDetails?: LocalizedText; // LocalizedText ns=0;i=21
  /** It is the status of the joint.
Examples: Ok, InUse, NotInUse, NotYetDone, etc.*/
  jointStatus?: UAString; // String ns=0;i=31918
  /** It is the list of entities associated to the joint.
Examples: JoiningProcessId, JobId, QualityProcessId, SimulationProcessId, etc.*/
  associatedEntities?: DTEntity[]; // ExtensionObject ns=18;i=3010
  /** It is a human readable text to identify the joining technology.*/
  joiningTechnology?: LocalizedText; // LocalizedText ns=0;i=21
}
export interface UDTJoint extends ExtensionObject, DTJoint {};