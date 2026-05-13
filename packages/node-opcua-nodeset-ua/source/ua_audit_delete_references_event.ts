import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTDeleteReferencesItem } from "./dt_delete_references_item";
import type { UAAuditNodeManagementEvent, UAAuditNodeManagementEvent_Base } from "./ua_audit_node_management_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditDeleteReferencesEventType i=2097                       |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditDeleteReferencesEvent_Base extends UAAuditNodeManagementEvent_Base {
    referencesToDelete: UAProperty<DTDeleteReferencesItem[], DataType.ExtensionObject>;
}
export interface UAAuditDeleteReferencesEvent extends UAAuditNodeManagementEvent, UAAuditDeleteReferencesEvent_Base {}