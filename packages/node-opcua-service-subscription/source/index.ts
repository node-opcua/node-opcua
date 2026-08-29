/**
 * @module node-opcua-service-subscription
 */

export type {
    CreateMonitoredItemsRequestOptions,
    CreateSubscriptionRequestOptions,
    DeleteMonitoredItemsRequestOptions,
    DeleteSubscriptionsRequestOptions,
    ModifyMonitoredItemsRequestOptions,
    ModifySubscriptionRequestOptions,
    MonitoredItemCreateRequestOptions,
    MonitoringParametersOptions,
    PublishRequestOptions,
    PublishResponseOptions,
    RepublishRequestOptions,
    RepublishResponseOptions,
    SetMonitoringModeRequestOptions,
    SetPublishingModeRequestOptions,
    SetTriggeringRequestOptions,
    TransferSubscriptionsRequestOptions
} from "node-opcua-types";
export {
    AggregateFilter,
    ContentFilterElementResult,
    ContentFilterResult,
    CreateMonitoredItemsRequest,
    CreateMonitoredItemsResponse,
    CreateSubscriptionRequest,
    CreateSubscriptionResponse,
    DataChangeFilter,
    DataChangeNotification,
    DataChangeTrigger,
    DeleteMonitoredItemsRequest,
    DeleteMonitoredItemsResponse,
    DeleteSubscriptionsRequest,
    DeleteSubscriptionsResponse,
    EventFieldList,
    EventFilterResult,
    EventNotificationList,
    ModifyMonitoredItemsRequest,
    ModifyMonitoredItemsResponse,
    ModifySubscriptionRequest,
    ModifySubscriptionResponse,
    MonitoredItemCreateRequest,
    MonitoredItemCreateResult,
    MonitoredItemModifyRequest,
    MonitoredItemModifyResult,
    MonitoredItemNotification,
    MonitoringMode,
    MonitoringParameters,
    NotificationData,
    NotificationMessage,
    PublishRequest,
    PublishResponse,
    RepublishRequest,
    RepublishResponse,
    SetMonitoringModeRequest,
    SetMonitoringModeResponse,
    SetPublishingModeRequest,
    SetPublishingModeResponse,
    SetTriggeringRequest,
    SetTriggeringResponse,
    StatusChangeNotification,
    SubscriptionAcknowledgement,
    TransferResult,
    TransferSubscriptionsRequest,
    TransferSubscriptionsResponse
} from "node-opcua-types";

export * from "./deadband_checker.js";

import { assert } from "node-opcua-assert";
import { MonitoringParameters, PublishResponse } from "node-opcua-types";

assert(PublishResponse.schema.fields[1].name === "subscriptionId");
PublishResponse.schema.fields[1].defaultValue = 0xffffffff;

assert(MonitoringParameters.schema.fields[0].name === "clientHandle");
MonitoringParameters.schema.fields[0].defaultValue = 0xffffffff;
