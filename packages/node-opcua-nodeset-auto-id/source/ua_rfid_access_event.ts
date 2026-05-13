import type { UAProperty } from "node-opcua-address-space-base";
import type { DataType } from "node-opcua-variant";

import type { DTRfidAccessResult } from "./dt_rfid_access_result";
import type { UAAutoIdAccessEvent, UAAutoIdAccessEvent_Base } from "./ua_auto_id_access_event";

// ----- this file has been automatically generated - do not edit

/**
 * Data of the access on one or more Rfid
 * Transponder.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/                         |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |RfidAccessEventType i=1016                                  |
 * |isAbstract      |true                                                        |
 */
export interface UARfidAccessEvent_Base extends UAAutoIdAccessEvent_Base {
    /**
     * accessResult
     * Result values of the access.
     */
    accessResult: UAProperty<DTRfidAccessResult[], DataType.ExtensionObject>;
}
export interface UARfidAccessEvent extends Omit<UAAutoIdAccessEvent, "accessResult">, UARfidAccessEvent_Base {}