// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UADiscreteAlarm, UADiscreteAlarm_Base } from "node-opcua-nodeset-ua/dist/ua_discrete_alarm"
/**
 * Event transmitting Alarms within a CNC system.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CncAlarmType i=1006                                         |
 * |isAbstract      |false                                                       |
 */
export interface UACncAlarm_Base extends UADiscreteAlarm_Base {
    /**
     * alarmIdentifier
     * Unique alarm number.
     */
    alarmIdentifier: UAProperty<UAString, DataType.String>;
    /**
     * auxParameters
     * Array of auxiliary parameter for additional alarm
     * description.
     */
    auxParameters?: UAProperty<UAString[], DataType.String>;
    /**
     * helpSource
     * Additional information to message giving
     * information on how to solve problem that caused
     * the alarm.
     */
    helpSource?: UAProperty<UAString, DataType.String>;
}
export interface UACncAlarm extends UADiscreteAlarm, UACncAlarm_Base {
}