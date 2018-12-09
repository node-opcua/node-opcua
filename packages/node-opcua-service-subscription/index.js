"use strict";
/**
 * @module services.subscription
 */
require("node-opcua-extension-object");

module.exports = {

    /**
     * @class TimestampsToReturn
     */
    MonitoringMode: require("./schemas/MonitoringMode_enum").MonitoringMode,
    /**
     * @class TimestampsToReturn
     */
    DataChangeTrigger: require("./schemas/DataChangeTrigger_enum").DataChangeTrigger,
    /**
     * @class TimestampsToReturn
     */
    DeadbandType: require("./schemas/DeadbandType_enum").DeadbandType,

    /**
     * @class TimestampsToReturn
     */
    TimestampsToReturn: require("node-opcua-data-value").TimestampsToReturn,

    /**
     * @class CreateSubscriptionRequest
     */
    CreateSubscriptionRequest: require("./_generated_/_auto_generated_CreateSubscriptionRequest").CreateSubscriptionRequest,
    /**
     * @class CreateSubscriptionResponse
     */
    CreateSubscriptionResponse: require("./_generated_/_auto_generated_CreateSubscriptionResponse").CreateSubscriptionResponse,
    /**
     * @class ModifySubscriptionRequest
     */
    ModifySubscriptionRequest: require("./_generated_/_auto_generated_ModifySubscriptionRequest").ModifySubscriptionRequest,
    /**
     * @class ModifySubscriptionResponse
     */
    ModifySubscriptionResponse: require("./_generated_/_auto_generated_ModifySubscriptionResponse").ModifySubscriptionResponse,

    /**
     * @class MonitoringParameters
     */
    MonitoringParameters: require("./_generated_/_auto_generated_MonitoringParameters").MonitoringParameters,
    /**
     * @class MonitoredItemCreateRequest
     */
    MonitoredItemCreateRequest: require("./_generated_/_auto_generated_MonitoredItemCreateRequest").MonitoredItemCreateRequest,
    /**
     * @class CreateMonitoredItemsRequest
     */
    CreateMonitoredItemsRequest: require("./_generated_/_auto_generated_CreateMonitoredItemsRequest").CreateMonitoredItemsRequest,
    /**
     * @class MonitoredItemCreateResult
     */
    MonitoredItemCreateResult: require("./_generated_/_auto_generated_MonitoredItemCreateResult").MonitoredItemCreateResult,
    /**
     * @class CreateMonitoredItemsResponse
     */
    CreateMonitoredItemsResponse: require("./_generated_/_auto_generated_CreateMonitoredItemsResponse").CreateMonitoredItemsResponse,
    /**
     * @class SubscriptionAcknowledgement
     */
    SubscriptionAcknowledgement: require("./_generated_/_auto_generated_SubscriptionAcknowledgement").SubscriptionAcknowledgement,
    /**
     * @class PublishRequest
     */
    PublishRequest: require("./_generated_/_auto_generated_PublishRequest").PublishRequest,

    /**
     * @class NotificationMessage
     */
    NotificationMessage: require("./_generated_/_auto_generated_NotificationMessage").NotificationMessage,

// possible notifications used inNotificationMessage
    /**
     * @class DataChangeNotification
     */
    DataChangeNotification: require("./_generated_/_auto_generated_DataChangeNotification").DataChangeNotification,
    /**
     * @class StatusChangeNotification
     */
    StatusChangeNotification: require("./_generated_/_auto_generated_StatusChangeNotification").StatusChangeNotification,
    /**
     * @class EventNotificationList
     */
    EventNotificationList: require("./_generated_/_auto_generated_EventNotificationList").EventNotificationList,
    /**
     * @class PublishResponse
     */
    PublishResponse: require("./_generated_/_auto_generated_PublishResponse").PublishResponse,
    /**
     * @class RepublishRequest
     */
    RepublishRequest: require("./_generated_/_auto_generated_RepublishRequest").RepublishRequest,
    /**
     * @class RepublishResponse
     */
    RepublishResponse: require("./_generated_/_auto_generated_RepublishResponse").RepublishResponse,
    /**
     * @class DeleteMonitoredItemsRequest
     */
    DeleteMonitoredItemsRequest: require("./_generated_/_auto_generated_DeleteMonitoredItemsRequest").DeleteMonitoredItemsRequest,
    /**
     * @class DeleteMonitoredItemsResponse
     */
    DeleteMonitoredItemsResponse: require("./_generated_/_auto_generated_DeleteMonitoredItemsResponse").DeleteMonitoredItemsResponse,
    /**
     * @class SetPublishingModeRequest
     */
    SetPublishingModeRequest: require("./_generated_/_auto_generated_SetPublishingModeRequest").SetPublishingModeRequest,
    /**
     * @class SetPublishingModeResponse
     */
    SetPublishingModeResponse: require("./_generated_/_auto_generated_SetPublishingModeResponse").SetPublishingModeResponse,
    /**
     * @class DeleteSubscriptionsRequest
     */
    DeleteSubscriptionsRequest: require("./_generated_/_auto_generated_DeleteSubscriptionsRequest").DeleteSubscriptionsRequest,
    /**
     * @class DeleteSubscriptionsResponse
     */
    DeleteSubscriptionsResponse: require("./_generated_/_auto_generated_DeleteSubscriptionsResponse").DeleteSubscriptionsResponse,
    /**
     * @class MonitoredItemNotification
     */
    MonitoredItemNotification: require("./_generated_/_auto_generated_MonitoredItemNotification").MonitoredItemNotification,
    /**
     * @class MonitoredItemModifyRequest
     */
    MonitoredItemModifyRequest: require("./_generated_/_auto_generated_MonitoredItemModifyRequest").MonitoredItemModifyRequest,
    /**
     * @class MonitoredItemModifyResult
     */
    MonitoredItemModifyResult: require("./_generated_/_auto_generated_MonitoredItemModifyResult").MonitoredItemModifyResult,
    /**
     * @class ModifyMonitoredItemsRequest
     */
    ModifyMonitoredItemsRequest: require("./_generated_/_auto_generated_ModifyMonitoredItemsRequest").ModifyMonitoredItemsRequest,
    /**
     * @class ModifyMonitoredItemsResponse
     */
    ModifyMonitoredItemsResponse: require("./_generated_/_auto_generated_ModifyMonitoredItemsResponse").ModifyMonitoredItemsResponse,
    /**
     * @class SetMonitoringModeRequest
     */
    SetMonitoringModeRequest: require("./_generated_/_auto_generated_SetMonitoringModeRequest").SetMonitoringModeRequest,
    /**
     * @class SetMonitoringModeResponse
     */
    SetMonitoringModeResponse: require("./_generated_/_auto_generated_SetMonitoringModeResponse").SetMonitoringModeResponse,

// Event results
    /**
     * @class EventFilterResult
     */
    EventFilterResult: require("./_generated_/_auto_generated_EventFilterResult").EventFilterResult,
    /**
     * @class ContentFilterResult
     */
    ContentFilterResult: require("./_generated_/_auto_generated_ContentFilterResult").ContentFilterResult,
    /**
     * @class ContentFilterElementResult
     */
    ContentFilterElementResult: require("./_generated_/_auto_generated_ContentFilterElementResult").ContentFilterElementResult,

    /**
     * @class EventFieldList
     */
    EventFieldList: require("./_generated_/_auto_generated_EventFieldList").EventFieldList,
    /**
     * @class DataChangeFilter
     */
    DataChangeFilter: require("./_generated_/_auto_generated_DataChangeFilter").DataChangeFilter,

    /**
     * @class AggregateFilter
     */
    AggregateFilter: require("./_generated_/_auto_generated_AggregateFilter").AggregateFilter,

    /**
     * @class SetTriggeringRequest
     */
    SetTriggeringRequest: require("./_generated_/_auto_generated_SetTriggeringRequest").SetTriggeringRequest,

    /**
     * @class SetTriggeringResponse
     */
    SetTriggeringResponse: require("./_generated_/_auto_generated_SetTriggeringResponse").SetTriggeringResponse,

    /**
     * @class TransferResult
     */
    TransferResult: require("./_generated_/_auto_generated_TransferResult").TransferResult,

    /**
     * @class TransferSubscriptionsRequest
     */
    TransferSubscriptionsRequest: require("./_generated_/_auto_generated_TransferSubscriptionsRequest").TransferSubscriptionsRequest,

    /**
     * @class TransferSubscriptionsResponse
     */
    TransferSubscriptionsResponse: require("./_generated_/_auto_generated_TransferSubscriptionsResponse").TransferSubscriptionsResponse,


    check_deadband: require("./src/deadband_checker").check_deadband,
};
