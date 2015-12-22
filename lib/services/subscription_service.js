"use strict";
/**
 * @module services.subscription
 */
require("requirish")._(module);

require("lib/misc/extension_object");
/**
 * @class TimestampsToReturn
 */
exports.MonitoringMode = require("schemas/MonitoringMode_enum").MonitoringMode;
/**
 * @class TimestampsToReturn
 */
exports.DataChangeTrigger = require("schemas/DataChangeTrigger_enum").DataChangeTrigger;
/**
 * @class TimestampsToReturn
 */
exports.DeadbandType = require("schemas/DeadbandType_enum").DeadbandType;

/**
 * @class TimestampsToReturn
 */
exports.TimestampsToReturn = require("schemas/TimestampsToReturn_enum").TimestampsToReturn;

/**
 * @class CreateSubscriptionRequest
 */
exports.CreateSubscriptionRequest = require("_generated_/_auto_generated_CreateSubscriptionRequest").CreateSubscriptionRequest;
/**
 * @class CreateSubscriptionResponse
 */
exports.CreateSubscriptionResponse = require("_generated_/_auto_generated_CreateSubscriptionResponse").CreateSubscriptionResponse;
/**
 * @class ModifySubscriptionRequest
 */
exports.ModifySubscriptionRequest = require("_generated_/_auto_generated_ModifySubscriptionRequest").ModifySubscriptionRequest;
/**
 * @class ModifySubscriptionResponse
 */
exports.ModifySubscriptionResponse = require("_generated_/_auto_generated_ModifySubscriptionResponse").ModifySubscriptionResponse;

/**
 * @class MonitoringParameters
 */
exports.MonitoringParameters = require("_generated_/_auto_generated_MonitoringParameters").MonitoringParameters;
/**
 * @class MonitoredItemCreateRequest
 */
exports.MonitoredItemCreateRequest = require("_generated_/_auto_generated_MonitoredItemCreateRequest").MonitoredItemCreateRequest;
/**
 * @class CreateMonitoredItemsRequest
 */
exports.CreateMonitoredItemsRequest = require("_generated_/_auto_generated_CreateMonitoredItemsRequest").CreateMonitoredItemsRequest;
/**
 * @class MonitoredItemCreateResult
 */
exports.MonitoredItemCreateResult = require("_generated_/_auto_generated_MonitoredItemCreateResult").MonitoredItemCreateResult;
/**
 * @class CreateMonitoredItemsResponse
 */
exports.CreateMonitoredItemsResponse = require("_generated_/_auto_generated_CreateMonitoredItemsResponse").CreateMonitoredItemsResponse;
/**
 * @class SubscriptionAcknowledgement
 */
exports.SubscriptionAcknowledgement = require("_generated_/_auto_generated_SubscriptionAcknowledgement").SubscriptionAcknowledgement;
/**
 * @class PublishRequest
 */
exports.PublishRequest = require("_generated_/_auto_generated_PublishRequest").PublishRequest;

/**
 * @class NotificationMessage
 */
exports.NotificationMessage = require("_generated_/_auto_generated_NotificationMessage").NotificationMessage;

// possible notifications used inNotificationMessage
/**
 * @class DataChangeNotification
 */
exports.DataChangeNotification = require("_generated_/_auto_generated_DataChangeNotification").DataChangeNotification;
/**
 * @class StatusChangeNotification
 */
exports.StatusChangeNotification = require("_generated_/_auto_generated_StatusChangeNotification").StatusChangeNotification;
/**
 * @class EventNotificationList
 */
exports.EventNotificationList = require("_generated_/_auto_generated_EventNotificationList").EventNotificationList;
/**
 * @class PublishResponse
 */
exports.PublishResponse = require("_generated_/_auto_generated_PublishResponse").PublishResponse;
/**
 * @class RepublishRequest
 */
exports.RepublishRequest = require("_generated_/_auto_generated_RepublishRequest").RepublishRequest;
/**
 * @class RepublishResponse
 */
exports.RepublishResponse = require("_generated_/_auto_generated_RepublishResponse").RepublishResponse;
/**
 * @class DeleteMonitoredItemsRequest
 */
exports.DeleteMonitoredItemsRequest = require("_generated_/_auto_generated_DeleteMonitoredItemsRequest").DeleteMonitoredItemsRequest;
/**
 * @class DeleteMonitoredItemsResponse
 */
exports.DeleteMonitoredItemsResponse = require("_generated_/_auto_generated_DeleteMonitoredItemsResponse").DeleteMonitoredItemsResponse;
/**
 * @class SetPublishingModeRequest
 */
exports.SetPublishingModeRequest = require("_generated_/_auto_generated_SetPublishingModeRequest").SetPublishingModeRequest;
/**
 * @class SetPublishingModeResponse
 */
exports.SetPublishingModeResponse = require("_generated_/_auto_generated_SetPublishingModeResponse").SetPublishingModeResponse;
/**
 * @class DeleteSubscriptionsRequest
 */
exports.DeleteSubscriptionsRequest = require("_generated_/_auto_generated_DeleteSubscriptionsRequest").DeleteSubscriptionsRequest;
/**
 * @class DeleteSubscriptionsResponse
 */
exports.DeleteSubscriptionsResponse = require("_generated_/_auto_generated_DeleteSubscriptionsResponse").DeleteSubscriptionsResponse;
/**
 * @class MonitoredItemNotification
 */
exports.MonitoredItemNotification = require("_generated_/_auto_generated_MonitoredItemNotification").MonitoredItemNotification;
/**
 * @class MonitoredItemModifyRequest
 */
exports.MonitoredItemModifyRequest = require("_generated_/_auto_generated_MonitoredItemModifyRequest").MonitoredItemModifyRequest;
/**
 * @class MonitoredItemModifyResult
 */
exports.MonitoredItemModifyResult = require("_generated_/_auto_generated_MonitoredItemModifyResult").MonitoredItemModifyResult;
/**
 * @class ModifyMonitoredItemsRequest
 */
exports.ModifyMonitoredItemsRequest = require("_generated_/_auto_generated_ModifyMonitoredItemsRequest").ModifyMonitoredItemsRequest;
/**
 * @class ModifyMonitoredItemsResponse
 */
exports.ModifyMonitoredItemsResponse = require("_generated_/_auto_generated_ModifyMonitoredItemsResponse").ModifyMonitoredItemsResponse;
/**
 * @class SetMonitoringModeRequest
 */
exports.SetMonitoringModeRequest = require("_generated_/_auto_generated_SetMonitoringModeRequest").SetMonitoringModeRequest;
/**
 * @class SetMonitoringModeResponse
 */
exports.SetMonitoringModeResponse = require("_generated_/_auto_generated_SetMonitoringModeResponse").SetMonitoringModeResponse;

// Event results
/**
 * @class EventFilterResult
 */
exports.EventFilterResult = require("_generated_/_auto_generated_EventFilterResult").EventFilterResult;
/**
 * @class ContentFilterResult
 */
exports.ContentFilterResult = require("_generated_/_auto_generated_ContentFilterResult").ContentFilterResult;
/**
 * @class ContentFilterElementResult
 */
exports.ContentFilterElementResult = require("_generated_/_auto_generated_ContentFilterElementResult").ContentFilterElementResult;

// ContentFilters
/**
 * @class FilterOperator
 */
exports.FilterOperator = require("schemas/FilterOperator_enum").FilterOperator;
/**
 * @class SimpleAttributeOperand
 */
exports.SimpleAttributeOperand = require("_generated_/_auto_generated_SimpleAttributeOperand").SimpleAttributeOperand;
/**
 * @class ElementOperand
 */
exports.ElementOperand = require("_generated_/_auto_generated_ElementOperand").ElementOperand;
/**
 * @class LiteralOperand
 */
exports.LiteralOperand = require("_generated_/_auto_generated_LiteralOperand").LiteralOperand;
/**
 * @class AttributeOperand
 */
exports.AttributeOperand = require("_generated_/_auto_generated_AttributeOperand").AttributeOperand;
/**
 * @class ContentFilterElement
 */
exports.ContentFilterElement = require("_generated_/_auto_generated_ContentFilterElement").ContentFilterElement;
/**
 * @class ContentFilter
 */
exports.ContentFilter = require("_generated_/_auto_generated_ContentFilter").ContentFilter;
/**
 * @class EventFilter
 */
exports.EventFilter = require("_generated_/_auto_generated_EventFilter").EventFilter;
/**
 * @class EventFieldList
 */
exports.EventFieldList = require("_generated_/_auto_generated_EventFieldList").EventFieldList;
/**
 * @class DataChangeFilter
 */
exports.DataChangeFilter = require("_generated_/_auto_generated_DataChangeFilter").DataChangeFilter;


/**
 * @class SetTriggeringRequest
 */
exports.SetTriggeringRequest = require("_generated_/_auto_generated_SetTriggeringRequest").SetTriggeringRequest;

/**
 * @class SetTriggeringResponse
 */
exports.SetTriggeringResponse = require("_generated_/_auto_generated_SetTriggeringResponse").SetTriggeringResponse;


/**
 * @class TransferSubscriptionsRequest
 */
exports.TransferSubscriptionsRequest = require("_generated_/_auto_generated_TransferSubscriptionsRequest").TransferSubscriptionsRequest;

/**
 * @class TransferSubscriptionsResponse
 */
exports.TransferSubscriptionsResponse = require("_generated_/_auto_generated_TransferSubscriptionsResponse").TransferSubscriptionsResponse;
