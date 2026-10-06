import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { UAAuditWriteUpdateEvent, UAAuditWriteUpdateEvent_Base } from "node-opcua-nodeset-ua/dist/ua_audit_write_update_event.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditUpdateConnectionConfigurationSetEventType i=1017       |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditUpdateConnectionConfigurationSetEvent_Base extends UAAuditWriteUpdateEvent_Base {
    connectionConfigurationSetNode: UAProperty<NodeId, DataType.NodeId>;
    name: UAProperty<UAString, DataType.String>;
}
export interface UAAuditUpdateConnectionConfigurationSetEvent extends UAAuditWriteUpdateEvent, UAAuditUpdateConnectionConfigurationSetEvent_Base {}