// ----- this file has been automatically generated - do not edit
import { UAAutoIdDiagnosticsEvent, UAAutoIdDiagnosticsEvent_Base } from "./ua_auto_id_diagnostics_event"
/**
 * One entry written to the log of the device.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AutoIdLogEntryEventType i=1017                              |
 * |isAbstract      |true                                                        |
 */
export type UAAutoIdLogEntryEvent_Base = UAAutoIdDiagnosticsEvent_Base;
export interface UAAutoIdLogEntryEvent extends UAAutoIdDiagnosticsEvent, UAAutoIdLogEntryEvent_Base {
}