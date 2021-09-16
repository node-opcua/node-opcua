// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, UInt16, Int16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UADiscreteAlarm, UADiscreteAlarm_Base } from "node-opcua-nodeset-ua/source/ua_discrete_alarm"
/**
 * Event transmitting Alarms within a CNC system.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |11:CncAlarmType ns=11;i=1006                      |
 * |isAbstract      |false                                             |
 */
export interface UACncAlarm_Base extends UADiscreteAlarm_Base {
    /**
     * alarmIdentifier
     * Unique alarm number.
     */
    alarmIdentifier: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * auxParameters
     * Array of auxiliary parameter for additional alarm
     * description.
     */
    auxParameters?: UAProperty<UAString[], /*z*/DataType.String>;
    /**
     * helpSource
     * Additional information to message giving
     * information on how to solve problem that caused
     * the alarm.
     */
    helpSource?: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UACncAlarm extends UADiscreteAlarm, UACncAlarm_Base {
}