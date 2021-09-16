// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { UAKeyCredentialAuditEvent, UAKeyCredentialAuditEvent_Base } from "node-opcua-nodeset-ua/source/ua_key_credential_audit_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/GDS/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |6:KeyCredentialRequestedAuditEventType ns=6;i=1039|
 * |isAbstract      |false                                             |
 */
export interface UAKeyCredentialRequestedAuditEvent_Base extends UAKeyCredentialAuditEvent_Base {
}
export interface UAKeyCredentialRequestedAuditEvent extends UAKeyCredentialAuditEvent, UAKeyCredentialRequestedAuditEvent_Base {
}