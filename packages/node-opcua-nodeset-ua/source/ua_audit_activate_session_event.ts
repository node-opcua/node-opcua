import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { NodeId } from "node-opcua-nodeid";
import type { DataType } from "node-opcua-variant";

import type { DTSignedSoftwareCertificate } from "./dt_signed_software_certificate";
import type { DTUserIdentityToken } from "./dt_user_identity_token";
import type { UAAuditSessionEvent, UAAuditSessionEvent_Base } from "./ua_audit_session_event";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AuditActivateSessionEventType i=2075                        |
 * |isAbstract      |true                                                        |
 */
export interface UAAuditActivateSessionEvent_Base extends UAAuditSessionEvent_Base {
    clientSoftwareCertificates: UAProperty<DTSignedSoftwareCertificate[], DataType.ExtensionObject>;
    userIdentityToken: UAProperty<DTUserIdentityToken, DataType.ExtensionObject>;
    secureChannelId: UAProperty<UAString, DataType.String>;
    currentRoleIds?: UAProperty<NodeId[], DataType.NodeId>;
}
export interface UAAuditActivateSessionEvent extends UAAuditSessionEvent, UAAuditActivateSessionEvent_Base {}