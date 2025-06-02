// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAlarmCondition, UAAlarmCondition_Base } from "node-opcua-nodeset-ua/dist/ua_alarm_condition"
import { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ScaleAlarmType i=21                                         |
 * |isAbstract      |false                                                       |
 */
export interface UAScaleAlarm_Base extends UAAlarmCondition_Base {
    auxParameters?: UAProperty<UAString[], DataType.String>;
    helpSource?: UAProperty<UAString, DataType.String>;
    notificationCategory: UAMultiStateValueDiscrete<any, any>;
    notificationId: UAMultiStateValueDiscrete<any, any>;
    vendorNotificationId?: UABaseDataVariable<UAString, DataType.String>;
}
export interface UAScaleAlarm extends UAAlarmCondition, UAScaleAlarm_Base {
}