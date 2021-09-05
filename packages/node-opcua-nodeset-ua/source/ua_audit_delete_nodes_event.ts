// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTDeleteNodesItem } from "./dt_delete_nodes_item"
import { UAAuditNodeManagementEvent, UAAuditNodeManagementEvent_Base } from "./ua_audit_node_management_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditDeleteNodesEventType ns=0;i=2093             |
 * |isAbstract      |true                                              |
 */
export interface UAAuditDeleteNodesEvent_Base extends UAAuditNodeManagementEvent_Base {
    nodesToDelete: UAProperty<DTDeleteNodesItem[], /*z*/DataType.ExtensionObject>;
}
export interface UAAuditDeleteNodesEvent extends UAAuditNodeManagementEvent, UAAuditDeleteNodesEvent_Base {
}