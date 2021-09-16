// ----- this file has been automatically generated - do not edit
import { UAAutoIdDiagnosticsEvent, UAAutoIdDiagnosticsEvent_Base } from "./ua_auto_id_diagnostics_event"
/**
 * One entry written to the log of the device.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:AutoIdLogEntryEventType ns=3;i=1017             |
 * |isAbstract      |true                                              |
 */
export interface UAAutoIdLogEntryEvent_Base extends UAAutoIdDiagnosticsEvent_Base {
}
export interface UAAutoIdLogEntryEvent extends UAAutoIdDiagnosticsEvent, UAAutoIdLogEntryEvent_Base {
}