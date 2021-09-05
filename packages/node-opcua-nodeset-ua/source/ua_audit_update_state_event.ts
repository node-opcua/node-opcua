// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAuditUpdateMethodEvent, UAAuditUpdateMethodEvent_Base } from "./ua_audit_update_method_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditUpdateStateEventType ns=0;i=2315             |
 * |isAbstract      |true                                              |
 */
export interface UAAuditUpdateStateEvent_Base extends UAAuditUpdateMethodEvent_Base {
    oldStateId: UAProperty<any, any>;
    newStateId: UAProperty<any, any>;
}
export interface UAAuditUpdateStateEvent extends UAAuditUpdateMethodEvent, UAAuditUpdateStateEvent_Base {
}