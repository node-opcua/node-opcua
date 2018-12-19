/**
 * @module node-opcua-service-subscription
 */
export {
    NotificationData,
    MonitoringMode,
    DataChangeTrigger,
    CreateSubscriptionRequest, CreateSubscriptionResponse, CreateSubscriptionRequestOptions,
    ModifySubscriptionRequest, ModifySubscriptionResponse, ModifySubscriptionRequestOptions,
    MonitoringParameters, MonitoringParametersOptions,
    MonitoredItemCreateRequest, MonitoredItemCreateResult, MonitoredItemCreateRequestOptions,
    CreateMonitoredItemsRequest, CreateMonitoredItemsResponse, CreateMonitoredItemsRequestOptions,
    SubscriptionAcknowledgement,
    PublishRequest,
    NotificationMessage,
    DataChangeNotification,
    StatusChangeNotification,
    EventNotificationList,
    PublishResponse,
    RepublishRequest,
    RepublishResponse,
    DeleteMonitoredItemsRequest, DeleteMonitoredItemsResponse, DeleteMonitoredItemsRequestOptions,
    SetPublishingModeRequest, SetPublishingModeResponse, SetPublishingModeRequestOptions,
    DeleteSubscriptionsRequest, DeleteSubscriptionsResponse, DeleteSubscriptionsRequestOptions,
    MonitoredItemNotification, MonitoredItemModifyRequest,
    MonitoredItemModifyResult, ModifyMonitoredItemsRequest, ModifyMonitoredItemsRequestOptions,
    ModifyMonitoredItemsResponse, SetMonitoringModeRequest, SetMonitoringModeRequestOptions,
    SetMonitoringModeResponse, EventFilterResult,
    ContentFilterResult, ContentFilterElementResult,
    EventFieldList, DataChangeFilter, AggregateFilter,
    SetTriggeringRequest, SetTriggeringResponse, SetTriggeringRequestOptions,
    TransferResult, TransferSubscriptionsRequest, TransferSubscriptionsRequestOptions,
    TransferSubscriptionsResponse

} from "node-opcua-types";

export * from "./deadband_checker";
import { assert } from "node-opcua-assert";
import { MonitoringParameters, PublishResponse } from "node-opcua-types";

assert(PublishResponse.schema.fields[1].name === "subscriptionId");
PublishResponse.schema.fields[1].defaultValue = 0xFFFFFFFF;

assert(MonitoringParameters.schema.fields[0].name === "clientHandle");
MonitoringParameters.schema.fields[0].defaultValue = 0xFFFFFFFF;
