require("requirish")._(module);

require("lib/misc/extension_object");

exports.MonitoringMode = require("schemas/MonitoringMode_enum").MonitoringMode;
exports.DataChangeTrigger = require("schemas/DataChangeTrigger_enum").DataChangeTrigger;
exports.DeadbandType = require("schemas/DeadbandType_enum").DeadbandType;

exports.TimestampsToReturn = require("schemas/TimestampsToReturn_enum").TimestampsToReturn;

exports.CreateSubscriptionRequest = require("_generated_/_auto_generated_CreateSubscriptionRequest").CreateSubscriptionRequest;
exports.CreateSubscriptionResponse = require("_generated_/_auto_generated_CreateSubscriptionResponse").CreateSubscriptionResponse;
exports.ModifySubscriptionRequest = require("_generated_/_auto_generated_ModifySubscriptionRequest").ModifySubscriptionRequest;
exports.ModifySubscriptionResponse = require("_generated_/_auto_generated_ModifySubscriptionResponse").ModifySubscriptionResponse;

exports.MonitoringParameters = require("_generated_/_auto_generated_MonitoringParameters").MonitoringParameters;
exports.MonitoredItemCreateRequest = require("_generated_/_auto_generated_MonitoredItemCreateRequest").MonitoredItemCreateRequest;
exports.CreateMonitoredItemsRequest = require("_generated_/_auto_generated_CreateMonitoredItemsRequest").CreateMonitoredItemsRequest;
exports.MonitoredItemCreateResult = require("_generated_/_auto_generated_MonitoredItemCreateResult").MonitoredItemCreateResult;
exports.CreateMonitoredItemsResponse = require("_generated_/_auto_generated_CreateMonitoredItemsResponse").CreateMonitoredItemsResponse;
exports.SubscriptionAcknowledgement = require("_generated_/_auto_generated_SubscriptionAcknowledgement").SubscriptionAcknowledgement;
exports.PublishRequest = require("_generated_/_auto_generated_PublishRequest").PublishRequest;

exports.NotificationMessage = require("_generated_/_auto_generated_NotificationMessage").NotificationMessage;

// possible notifications used inNotificationMessage
exports.DataChangeNotification = require("_generated_/_auto_generated_DataChangeNotification").DataChangeNotification;
exports.StatusChangeNotification =  require("_generated_/_auto_generated_StatusChangeNotification").StatusChangeNotification;
exports.EventNotificationList   =  require("_generated_/_auto_generated_EventNotificationList").EventNotificationList;

exports.PublishResponse = require("_generated_/_auto_generated_PublishResponse").PublishResponse;
exports.RepublishRequest = require("_generated_/_auto_generated_RepublishRequest").RepublishRequest;
exports.RepublishResponse = require("_generated_/_auto_generated_RepublishResponse").RepublishResponse;
exports.DeleteMonitoredItemsRequest = require("_generated_/_auto_generated_DeleteMonitoredItemsRequest").DeleteMonitoredItemsRequest;
exports.DeleteMonitoredItemsResponse = require("_generated_/_auto_generated_DeleteMonitoredItemsResponse").DeleteMonitoredItemsResponse;
exports.SetPublishingModeRequest = require("_generated_/_auto_generated_SetPublishingModeRequest").SetPublishingModeRequest;
exports.SetPublishingModeResponse = require("_generated_/_auto_generated_SetPublishingModeResponse").SetPublishingModeResponse;
exports.DeleteSubscriptionsRequest = require("_generated_/_auto_generated_DeleteSubscriptionsRequest").DeleteSubscriptionsRequest;
exports.DeleteSubscriptionsResponse = require("_generated_/_auto_generated_DeleteSubscriptionsResponse").DeleteSubscriptionsResponse;
exports.MonitoredItemNotification = require("_generated_/_auto_generated_MonitoredItemNotification").MonitoredItemNotification;
exports.MonitoredItemModifyRequest = require("_generated_/_auto_generated_MonitoredItemModifyRequest").MonitoredItemModifyRequest;
exports.MonitoredItemModifyResult = require("_generated_/_auto_generated_MonitoredItemModifyResult").MonitoredItemModifyResult;
exports.ModifyMonitoredItemsRequest = require("_generated_/_auto_generated_ModifyMonitoredItemsRequest").ModifyMonitoredItemsRequest;
exports.ModifyMonitoredItemsResponse = require("_generated_/_auto_generated_ModifyMonitoredItemsResponse").ModifyMonitoredItemsResponse;

exports.SetMonitoringModeRequest = require("_generated_/_auto_generated_SetMonitoringModeRequest").SetMonitoringModeRequest;
exports.SetMonitoringModeResponse = require("_generated_/_auto_generated_SetMonitoringModeResponse").SetMonitoringModeResponse;

// Event results
exports.EventFilterResult = require("_generated_/_auto_generated_EventFilterResult").EventFilterResult;
exports.ContentFilterResult = require("_generated_/_auto_generated_ContentFilterResult").ContentFilterResult;
exports.ContentFilterElementResult = require("_generated_/_auto_generated_ContentFilterElementResult").ContentFilterElementResult;

// ContentFilters
exports.FilterOperator = require("schemas/FilterOperator_enum").FilterOperator;
exports.SimpleAttributeOperand = require("_generated_/_auto_generated_SimpleAttributeOperand").SimpleAttributeOperand;
exports.ElementOperand  = require("_generated_/_auto_generated_ElementOperand").ElementOperand;
exports.LiteralOperand  = require("_generated_/_auto_generated_LiteralOperand").LiteralOperand;
exports.AttributeOperand= require("_generated_/_auto_generated_LiteralOperand").AttributeOperand;
exports.ContentFilterElement = require("_generated_/_auto_generated_ContentFilterElement").ContentFilterElement;
exports.ContentFilter = require("_generated_/_auto_generated_ContentFilter").ContentFilter;
exports.EventFilter = require("_generated_/_auto_generated_EventFilter").EventFilter;

exports.DataChangeFilter =  require("_generated_/_auto_generated_DataChangeFilter").DataChangeFilter;