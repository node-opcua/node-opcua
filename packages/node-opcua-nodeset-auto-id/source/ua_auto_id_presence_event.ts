import type { UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { UAAutoIdDiagnosticsEvent, UAAutoIdDiagnosticsEvent_Base } from "./ua_auto_id_diagnostics_event";

// ----- this file has been automatically generated - do not edit

/**
 * Current presence of AutoID Identifier.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutoIdPresenceEventType i=1018                              |
 * |isAbstract      |true                                                        |
 */
export interface UAAutoIdPresenceEvent_Base extends UAAutoIdDiagnosticsEvent_Base {
    /**
     * presence
     * Current presence of AutoID Identifier.
     */
    presence: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAAutoIdPresenceEvent extends UAAutoIdDiagnosticsEvent, UAAutoIdPresenceEvent_Base {}