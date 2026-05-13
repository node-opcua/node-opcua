import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTAddNodesItem } from "./dt_add_nodes_item";
import type { UAAuditNodeManagementEvent, UAAuditNodeManagementEvent_Base } from "./ua_audit_node_management_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditAddNodesEventType i=2091                               |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditAddNodesEvent_Base extends UAAuditNodeManagementEvent_Base {
    nodesToAdd: UAProperty<DTAddNodesItem[], DataType.ExtensionObject>;
}
export interface UAAuditAddNodesEvent extends UAAuditNodeManagementEvent, UAAuditAddNodesEvent_Base {}