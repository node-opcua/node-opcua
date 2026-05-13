import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTDeleteNodesItem } from "./dt_delete_nodes_item";
import type { UAAuditNodeManagementEvent, UAAuditNodeManagementEvent_Base } from "./ua_audit_node_management_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditDeleteNodesEventType i=2093                            |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditDeleteNodesEvent_Base extends UAAuditNodeManagementEvent_Base {
    nodesToDelete: UAProperty<DTDeleteNodesItem[], DataType.ExtensionObject>;
}
export interface UAAuditDeleteNodesEvent extends UAAuditNodeManagementEvent, UAAuditDeleteNodesEvent_Base {}