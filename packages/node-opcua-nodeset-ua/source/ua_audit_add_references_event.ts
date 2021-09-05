// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTAddReferencesItem } from "./dt_add_references_item"
import { UAAuditNodeManagementEvent, UAAuditNodeManagementEvent_Base } from "./ua_audit_node_management_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditAddReferencesEventType ns=0;i=2095           |
 * |isAbstract      |true                                              |
 */
export interface UAAuditAddReferencesEvent_Base extends UAAuditNodeManagementEvent_Base {
    referencesToAdd: UAProperty<DTAddReferencesItem[], /*z*/DataType.ExtensionObject>;
}
export interface UAAuditAddReferencesEvent extends UAAuditNodeManagementEvent, UAAuditAddReferencesEvent_Base {
}