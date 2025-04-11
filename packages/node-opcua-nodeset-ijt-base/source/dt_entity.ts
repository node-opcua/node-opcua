// ----- this file has been automatically generated - do not edit
import { Int16, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/dist/dt_structure"
/**
 * This structure provides the identification data
 * for a given entity in the system.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |EntityDataType                                              |
 * | isAbstract|false                                                       |
 */
export interface DTEntity extends DTStructure {
  /** It is the name of the entity identifier.
Examples: VIN, Program Id, etc.
Note: Application can send custom names which could be a combination of different terms in the system.*/
  name?: UAString; // String ns=0;i=12
  /** It is the description of the entity. Any additional information for the entity can be sent using this property. 
Examples: Name of the program in the given system.*/
  description?: UAString; // String ns=0;i=12
  /** It is the identifier of the given entity. 
Examples: JoiningProcessId, JointId, etc.*/
  entityId: UAString; // String ns=0;i=31918
  /** It is the origin identifier of the given entity. It is provided only when it is applicable and available for a given entity.
Examples: JoiningProcessOriginId, JointOriginId, etc.*/
  entityOriginId?: UAString; // String ns=0;i=31918
  /** It indicates if the EntityId is provided by the external system or not. 
Example: VIN is provided by an external system.*/
  isExternal?: boolean; // Boolean ns=0;i=1
  /** It provides the type of the Entity. It has the following pre-defined values which shall be used for each instance of this type.
Important Note: EntityType >=0 is defined as part of this specification.
For application specific extensions, EntityType < 0 can be used.*/
  entityType: Int16; // Int16 ns=0;i=4
}
export interface UDTEntity extends ExtensionObject, DTEntity {};