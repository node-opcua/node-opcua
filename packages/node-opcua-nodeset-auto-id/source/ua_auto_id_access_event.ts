// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { DTAccessResult } from "./dt_access_result"
import { UAAutoIdDiagnosticsEvent, UAAutoIdDiagnosticsEvent_Base } from "./ua_auto_id_diagnostics_event"
/**
 * Data of the access on one or more AutoID
 * Identifier.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:AutoIdAccessEventType ns=3;i=1015               |
 * |isAbstract      |true                                              |
 */
export interface UAAutoIdAccessEvent_Base extends UAAutoIdDiagnosticsEvent_Base {
    /**
     * accessResult
     * Result values of the access.
     */
    accessResult: UAProperty<DTAccessResult[], /*z*/DataType.ExtensionObject>;
    /**
     * client
     * Client which was the originator of the command.
     */
    client?: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * command
     * Access command
     */
    command?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UAAutoIdAccessEvent extends UAAutoIdDiagnosticsEvent, UAAutoIdAccessEvent_Base {
}