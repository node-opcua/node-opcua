// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16 } from "node-opcua-basic-types"
import { UAAutoIdDiagnosticsEvent, UAAutoIdDiagnosticsEvent_Base } from "./ua_auto_id_diagnostics_event"
/**
 * Current presence of AutoID Identifier.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:AutoIdPresenceEventType ns=3;i=1018             |
 * |isAbstract      |true                                              |
 */
export interface UAAutoIdPresenceEvent_Base extends UAAutoIdDiagnosticsEvent_Base {
    /**
     * presence
     * Current presence of AutoID Identifier.
     */
    presence: UAProperty<UInt16, /*z*/DataType.UInt16>;
}
export interface UAAutoIdPresenceEvent extends UAAutoIdDiagnosticsEvent, UAAutoIdPresenceEvent_Base {
}