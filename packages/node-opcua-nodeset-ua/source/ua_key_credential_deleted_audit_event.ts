import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAKeyCredentialAuditEvent, UAKeyCredentialAuditEvent_Base } from "./ua_key_credential_audit_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |KeyCredentialDeletedAuditEventType i=18047                  |
 * |isAbstract      |false                                                       |
 */
export interface UAKeyCredentialDeletedAuditEvent_Base extends UAKeyCredentialAuditEvent_Base {
    resourceUri: UAProperty<UAString, DataType.String>;
}
export interface UAKeyCredentialDeletedAuditEvent extends Omit<UAKeyCredentialAuditEvent, "resourceUri">, UAKeyCredentialDeletedAuditEvent_Base {}