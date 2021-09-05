// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAuditUpdateMethodEvent, UAAuditUpdateMethodEvent_Base } from "./ua_audit_update_method_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |KeyCredentialAuditEventType ns=0;i=18011          |
 * |isAbstract      |true                                              |
 */
export interface UAKeyCredentialAuditEvent_Base extends UAAuditUpdateMethodEvent_Base {
    resourceUri: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAKeyCredentialAuditEvent extends UAAuditUpdateMethodEvent, UAKeyCredentialAuditEvent_Base {
}