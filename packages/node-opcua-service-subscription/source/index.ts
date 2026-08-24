/**
 * @module node-opcua-service-subscription
 */
export {
    AggregateFilter,
    ContentFilterElementResult,
    ContentFilterResult,
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsRequestOptions,
    CreateMonitoredItemsResponse,
    CreateSubscriptionRequest,
    CreateSubscriptionRequestOptions,
    CreateSubscriptionResponse,
    DataChangeFilter,
    DataChangeNotification,
    DataChangeTrigger,
    DeleteMonitoredItemsRequest,
    DeleteMonitoredItemsRequestOptions,
    DeleteMonitoredItemsResponse,
    DeleteSubscriptionsRequest,
    DeleteSubscriptionsRequestOptions,
    DeleteSubscriptionsResponse,
    EventFieldList,
    EventFilterResult,
    EventNotificationList,
    ModifyMonitoredItemsRequest,
    ModifyMonitoredItemsRequestOptions,
    ModifyMonitoredItemsResponse,
    ModifySubscriptionRequest,
    ModifySubscriptionRequestOptions,
    ModifySubscriptionResponse,
    MonitoredItemCreateRequest,
    MonitoredItemCreateRequestOptions,
    MonitoredItemCreateResult,
    MonitoredItemModifyRequest,
    MonitoredItemModifyResult,
    MonitoredItemNotification,
    MonitoringMode,
    MonitoringParameters,
    MonitoringParametersOptions,
    NotificationData,
    NotificationMessage,
    PublishRequest,
    PublishRequestOptions,
    PublishResponse,
    PublishResponseOptions,
    RepublishRequest,
    RepublishRequestOptions,
    RepublishResponse,
    RepublishResponseOptions,
    SetMonitoringModeRequest,
    SetMonitoringModeRequestOptions,
    SetMonitoringModeResponse,
    SetPublishingModeRequest,
    SetPublishingModeRequestOptions,
    SetPublishingModeResponse,
    SetTriggeringRequest,
    SetTriggeringRequestOptions,
    SetTriggeringResponse,
    StatusChangeNotification,
    SubscriptionAcknowledgement,
    TransferResult,
    TransferSubscriptionsRequest,
    TransferSubscriptionsRequestOptions,
    TransferSubscriptionsResponse
} from "node-opcua-types";

export * from "./deadband_checker";

import { assert } from "node-opcua-assert";
import { MonitoringParameters, PublishResponse } from "node-opcua-types";

assert(PublishResponse.schema.fields[1].name === "subscriptionId");
PublishResponse.schema.fields[1].defaultValue = 0xffffffff;

assert(MonitoringParameters.schema.fields[0].name === "clientHandle");
MonitoringParameters.schema.fields[0].defaultValue = 0xffffffff;
