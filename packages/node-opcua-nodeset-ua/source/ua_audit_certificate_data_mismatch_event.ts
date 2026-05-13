import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAuditCertificateEvent, UAAuditCertificateEvent_Base } from "./ua_audit_certificate_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditCertificateDataMismatchEventType i=2082                |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditCertificateDataMismatchEvent_Base extends UAAuditCertificateEvent_Base {
    invalidHostname: UAProperty<UAString, DataType.String>;
    invalidUri: UAProperty<UAString, DataType.String>;
}
export interface UAAuditCertificateDataMismatchEvent extends UAAuditCertificateEvent, UAAuditCertificateDataMismatchEvent_Base {}