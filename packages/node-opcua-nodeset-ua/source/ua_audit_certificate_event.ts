// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAAuditSecurityEvent, UAAuditSecurityEvent_Base } from "./ua_audit_security_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditCertificateEventType ns=0;i=2080             |
 * |isAbstract      |true                                              |
 */
export interface UAAuditCertificateEvent_Base extends UAAuditSecurityEvent_Base {
    certificate: UAProperty<Buffer, /*z*/DataType.ByteString>;
}
export interface UAAuditCertificateEvent extends UAAuditSecurityEvent, UAAuditCertificateEvent_Base {
}