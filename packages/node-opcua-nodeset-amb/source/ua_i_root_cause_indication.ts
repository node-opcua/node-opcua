// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
import { DTRootCause } from "./dt_root_cause"
/**
 * Information on the root cause of conditions,
 * should be applied to alarms (AlarmType or
 * subtypes)
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AMB/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IRootCauseIndicationType i=1002                             |
 * |isAbstract      |true                                                        |
 */
export interface UAIRootCauseIndication_Base extends UABaseInterface_Base {
    /**
     * potentialRootCauses
     * An array of potential root causes of the alarm.
     * This is intended to be a hint to the client and
     * might be a local view on the potential root
     * causes of the alarm. The list might not contain
     * all potential root causes, that is, other
     * potential root causes might exist as well. If the
     * alarm itself is considered to be the root cause,
     * the array shall be empty. If no potential root
     * causes have been identified, there shall be at
     * least one entry in the array indicating that the
     * root cause is unknown.
     */
    potentialRootCauses: UAProperty<DTRootCause[], DataType.ExtensionObject>;
}
export interface UAIRootCauseIndication extends UABaseInterface, UAIRootCauseIndication_Base {
}