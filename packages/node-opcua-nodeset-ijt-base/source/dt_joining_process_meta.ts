// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { Int16, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
import { DTEntity } from "./dt_entity"
/**
 * This structure provides the meta data which
 * describes the joining process.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |JoiningProcessMetaDataType                                  |
 * | isAbstract|false                                                       |
 */
export interface DTJoiningProcessMeta extends DTStructure {
  /** It is the system-wide unique identifier of the joining process.*/
  joiningProcessId: UAString; // String ns=0;i=31918
  /** It is an identifier to track the changes made to the original instance in the system.
Example: It can point to the identifier of the object when it was created for the first time. It should be an existing ID in the system if it is available else it can be NULL if it is not tracked in a joining system.*/
  joiningProcessOriginId?: UAString; // String ns=0;i=31918
  /** It is the time when the joining process was created.*/
  creationTime?: Date; // DateTime ns=0;i=294
  /** It is the time when the joining process was updated last time. If it is not available, it can be same as CreationTime.*/
  lastUpdatedTime?: Date; // DateTime ns=0;i=294
  /** It is the name of the joining process.*/
  name?: UAString; // String ns=0;i=12
  /** It is the description of the joining process.*/
  description?: LocalizedText; // LocalizedText ns=0;i=21
  /** It is a human readable text to identify the joining technology.*/
  joiningTechnology?: LocalizedText; // LocalizedText ns=0;i=21
  /** It is the classification of the joining process.*/
  classification?: Int16; // Int16 ns=0;i=4
  /** It is the list of entities associated to the joining process.
Examples: ProductInstanceUri of the Controller.*/
  associatedEntities?: DTEntity[]; // ExtensionObject ns=18;i=3010
}
export interface UDTJoiningProcessMeta extends ExtensionObject, DTJoiningProcessMeta {};