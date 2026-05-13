import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTAddReferencesItem } from "./dt_add_references_item";
import type { UAAuditNodeManagementEvent, UAAuditNodeManagementEvent_Base } from "./ua_audit_node_management_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditAddReferencesEventType i=2095                          |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditAddReferencesEvent_Base extends UAAuditNodeManagementEvent_Base {
    referencesToAdd: UAProperty<DTAddReferencesItem[], DataType.ExtensionObject>;
}
export interface UAAuditAddReferencesEvent extends UAAuditNodeManagementEvent, UAAuditAddReferencesEvent_Base {}