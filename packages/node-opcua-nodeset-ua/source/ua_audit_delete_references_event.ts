// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTDeleteReferencesItem } from "./dt_delete_references_item"
import { UAAuditNodeManagementEvent, UAAuditNodeManagementEvent_Base } from "./ua_audit_node_management_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditDeleteReferencesEventType ns=0;i=2097        |
 * |isAbstract      |true                                              |
 */
export interface UAAuditDeleteReferencesEvent_Base extends UAAuditNodeManagementEvent_Base {
    referencesToDelete: UAProperty<DTDeleteReferencesItem[], /*z*/DataType.ExtensionObject>;
}
export interface UAAuditDeleteReferencesEvent extends UAAuditNodeManagementEvent, UAAuditDeleteReferencesEvent_Base {
}