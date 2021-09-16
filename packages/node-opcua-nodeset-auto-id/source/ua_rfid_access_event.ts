// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { DTAccessResult } from "./dt_access_result"
import { DTRfidAccessResult } from "./dt_rfid_access_result"
import { UAAutoIdAccessEvent, UAAutoIdAccessEvent_Base } from "./ua_auto_id_access_event"
/**
 * Data of the access on one or more Rfid
 * Transponder.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |3:RfidAccessEventType ns=3;i=1016                 |
 * |isAbstract      |true                                              |
 */
export interface UARfidAccessEvent_Base extends UAAutoIdAccessEvent_Base {
    /**
     * accessResult
     * Result values of the access.
     */
    accessResult: UAProperty<DTRfidAccessResult[], /*z*/DataType.ExtensionObject>;
}
export interface UARfidAccessEvent extends Omit<UAAutoIdAccessEvent, "accessResult">, UARfidAccessEvent_Base {
}