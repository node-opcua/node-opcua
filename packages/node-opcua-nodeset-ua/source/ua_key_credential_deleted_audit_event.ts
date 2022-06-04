// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAKeyCredentialAuditEvent, UAKeyCredentialAuditEvent_Base } from "./ua_key_credential_audit_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |KeyCredentialDeletedAuditEventType ns=0;i=18047   |
 * |isAbstract      |false                                             |
 */
export interface UAKeyCredentialDeletedAuditEvent_Base extends UAKeyCredentialAuditEvent_Base {
    resourceUri: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAKeyCredentialDeletedAuditEvent extends Omit<UAKeyCredentialAuditEvent, "resourceUri">, UAKeyCredentialDeletedAuditEvent_Base {
}