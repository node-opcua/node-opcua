// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTAddNodesItem } from "./dt_add_nodes_item"
import { UAAuditNodeManagementEvent, UAAuditNodeManagementEvent_Base } from "./ua_audit_node_management_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditAddNodesEventType ns=0;i=2091                |
 * |isAbstract      |true                                              |
 */
export interface UAAuditAddNodesEvent_Base extends UAAuditNodeManagementEvent_Base {
    nodesToAdd: UAProperty<DTAddNodesItem[], /*z*/DataType.ExtensionObject>;
}
export interface UAAuditAddNodesEvent extends UAAuditNodeManagementEvent, UAAuditAddNodesEvent_Base {
}