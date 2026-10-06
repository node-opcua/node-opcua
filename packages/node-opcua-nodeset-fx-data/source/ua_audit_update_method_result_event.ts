import type { UAProperty } from "node-opcua-address-space-base";
import type { UAAuditUpdateMethodEvent, UAAuditUpdateMethodEvent_Base } from "node-opcua-nodeset-ua/dist/ua_audit_update_method_event.js";
import type { StatusCode } from "node-opcua-status-code";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/Data/                        |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditUpdateMethodResultEventType i=1025                     |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditUpdateMethodResultEvent_Base extends UAAuditUpdateMethodEvent_Base {
    outputArguments: UAProperty<any, any>;
    statusCodeId: UAProperty<StatusCode, DataType.StatusCode>;
}
export interface UAAuditUpdateMethodResultEvent extends Omit<UAAuditUpdateMethodEvent, "outputArguments"|"statusCodeId">, UAAuditUpdateMethodResultEvent_Base {}