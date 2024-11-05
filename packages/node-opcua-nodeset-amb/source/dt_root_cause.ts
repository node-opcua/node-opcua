// ----- this file has been automatically generated - do not edit
import { LocalizedText } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * Root cause of an alarm
 *
 * |           |                                                            |
 * |-----------|------------------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AMB/                            |
 * | nodeClass |DataType                                                    |
 * | name      |RootCauseDataType                                           |
 * | isAbstract|false                                                       |
 */
export interface DTRootCause extends DTStructure {
  /** The NodeId of the root cause of an alarm. This can point to another Node in the AddressSpace or a ConditionId, that is not necessarily represent as Object in the AddressSpace. Ideally, this points directly to the root cause. Potentially, it points to an alarm that has an additional root cause. Clients shall expect, that they need to follow a path to find the root cause. If the root cause is unknown, the NodeId shall be set to NULL.*/
  rootCauseId: NodeId; // NodeId ns=0;i=17
  /** Localized description of the root cause of an alarm. This can be the DisplayName of the Node referenced by RootCauseId or a more descriptive text. If the root cause is unknown, this should be described in the text.*/
  rootCause: LocalizedText; // LocalizedText ns=0;i=21
}
export interface UDTRootCause extends ExtensionObject, DTRootCause {};