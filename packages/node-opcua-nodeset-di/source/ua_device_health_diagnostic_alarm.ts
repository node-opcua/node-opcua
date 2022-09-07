// ----- this file has been automatically generated - do not edit
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { NodeId } from "node-opcua-nodeid"
import { StatusCode } from "node-opcua-status-code"
import { UInt32, UInt16, Int16, UAString } from "node-opcua-basic-types"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UAInstrumentDiagnosticAlarm, UAInstrumentDiagnosticAlarm_Base } from "node-opcua-nodeset-ua/source/ua_instrument_diagnostic_alarm"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:DeviceHealthDiagnosticAlarmType ns=1;i=15143    |
 * |isAbstract      |true                                              |
 */
export type UADeviceHealthDiagnosticAlarm_Base = UAInstrumentDiagnosticAlarm_Base;
export interface UADeviceHealthDiagnosticAlarm extends UAInstrumentDiagnosticAlarm, UADeviceHealthDiagnosticAlarm_Base {
}