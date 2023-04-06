// ----- this file has been automatically generated - do not edit
import { Int32, UAString } from "node-opcua-basic-types"
import { ExtensionObject } from "node-opcua-extension-object"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/PackML/               |
 * | nodeClass |DataType                                          |
 * | name      |15:PackMLAlarmDataType                            |
 * | isAbstract|false                                             |
 */
export interface DTPackMLAlarm extends DTStructure {
  /** A unique number assigned to each type of alarm, stop or warning.*/
  ID: Int32; // Int32 ns=0;i=6
  /** An alarm, stop or warning message number associated to the ID to allow for user specific detail or to break down the Alarm.ID to greater detail*/
  value: Int32; // Int32 ns=0;i=6
  /** The actual text of the alarm, stop or warning for those machines capable of providing string information*/
  message: UAString; // String ns=0;i=12
  /** A user defined value which indicates what type of alarm, stop or warning has occurred. E.g. electrical, mechanical, process limit, …*/
  category: Int32; // Int32 ns=0;i=6
  /** The date and time that the alarm, stop or warning occurred, in ISO 8601 format (year, month, day, hour, minute, second, msec), as an array of 32 bit integers. Any unused date time elements should be set to zero*/
  dateTime: Date; // DateTime ns=0;i=294
  /** The date and time that the alarm, stop or warning has been acknowledged, in ISO 8601 format (year, month, day, hour, minute, second, msec), as an array of 32 bit integers. Any unused date time elements should be set to zero*/
  ackDateTime: Date; // DateTime ns=0;i=294
  /** This variable is true when the alarm is active*/
  trigger: boolean; // Boolean ns=0;i=1
}
export interface UDTPackMLAlarm extends ExtensionObject, DTPackMLAlarm {};