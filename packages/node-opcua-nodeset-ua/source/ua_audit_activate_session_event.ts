// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTSignedSoftwareCertificate } from "./dt_signed_software_certificate"
import { DTUserIdentityToken } from "./dt_user_identity_token"
import { UAAuditSessionEvent, UAAuditSessionEvent_Base } from "./ua_audit_session_event"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |AuditActivateSessionEventType ns=0;i=2075         |
 * |isAbstract      |true                                              |
 */
export interface UAAuditActivateSessionEvent_Base extends UAAuditSessionEvent_Base {
    clientSoftwareCertificates: UAProperty<DTSignedSoftwareCertificate[], /*z*/DataType.ExtensionObject>;
    userIdentityToken: UAProperty<DTUserIdentityToken, /*z*/DataType.ExtensionObject>;
    secureChannelId: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAAuditActivateSessionEvent extends UAAuditSessionEvent, UAAuditActivateSessionEvent_Base {
}