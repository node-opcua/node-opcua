import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { UAAuditSecurityEvent, UAAuditSecurityEvent_Base } from "./ua_audit_security_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditCertificateEventType i=2080                            |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditCertificateEvent_Base extends UAAuditSecurityEvent_Base {
    certificate: UAProperty<Buffer, DataType.ByteString>;
}
export interface UAAuditCertificateEvent extends UAAuditSecurityEvent, UAAuditCertificateEvent_Base {}