import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAuditUpdateMethodEvent, UAAuditUpdateMethodEvent_Base } from "./ua_audit_update_method_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |KeyCredentialAuditEventType i=18011                         |
 * |isAbstract      |true                                                        |
 */
export interface UAKeyCredentialAuditEvent_Base extends UAAuditUpdateMethodEvent_Base {
    resourceUri: UAProperty<UAString, DataType.String>;
}
export interface UAKeyCredentialAuditEvent extends UAAuditUpdateMethodEvent, UAKeyCredentialAuditEvent_Base {}