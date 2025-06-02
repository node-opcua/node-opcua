// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseEvent, UABaseEvent_Base } from "node-opcua-nodeset-ua/dist/ua_base_event"
import { UAMultiStateValueDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_value_discrete"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ScaleEventType i=13                                         |
 * |isAbstract      |false                                                       |
 */
export interface UAScaleEvent_Base extends UABaseEvent_Base {
    auxParameters?: UAProperty<UAString[], DataType.String>;
    helpSource?: UAProperty<UAString, DataType.String>;
    notificationCategory: UAMultiStateValueDiscrete<any, any>;
    notificationId: UAMultiStateValueDiscrete<any, any>;
    vendorNotificationId?: UABaseDataVariable<UAString, DataType.String>;
}
export interface UAScaleEvent extends UABaseEvent, UAScaleEvent_Base {
}