// ----- this file has been automatically generated - do not edit
import { UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * This structure contains the identification
 * information of a Joining Process. It is used in
 * set of methods defined in
 * JoiningProcessManagementType.
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/IJT/Base/                       |
 * | nodeClass |DataType                                                    |
 * | name      |JoiningProcessIdentificationDataType                        |
 * | isAbstract|false                                                       |
 */
export interface DTJoiningProcessIdentification extends DTStructure {
  /** It is the system-wide unique identifier of the joining process.*/
  joiningProcessId?: UAString; // String ns=0;i=31918
  /** It is an identifier to track the changes made to the original instance in the system.

Example: It can point to the identifier of the object when it was created for the first time. It should be an existing ID in the system if it is available else it can be NULL if it is not tracked in the system.*/
  joiningProcessOriginId?: UAString; // String ns=0;i=31918
  /** It is the configured selection name of the joining process in the system.*/
  selectionName?: UAString; // String ns=0;i=31918
}
export interface UDTJoiningProcessIdentification extends ExtensionObject, DTJoiningProcessIdentification {};