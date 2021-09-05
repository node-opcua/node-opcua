// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAuditCertificateEvent, UAAuditCertificateEvent_Base } from "./ua_audit_certificate_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditCertificateDataMismatchEventType ns=0;i=2082 |
 * |isAbstract      |true                                              |
 */
export interface UAAuditCertificateDataMismatchEvent_Base extends UAAuditCertificateEvent_Base {
    invalidHostname: UAProperty<UAString, /*z*/DataType.String>;
    invalidUri: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAAuditCertificateDataMismatchEvent extends UAAuditCertificateEvent, UAAuditCertificateDataMismatchEvent_Base {
}