var generator = require("node-opcua-generator");
var registerObject = generator.registerObject;

require("node-opcua-service-secure-channel");
require("node-opcua-service-read");
require("node-opcua-service-filter");
require("node-opcua-service-history");
require("node-opcua-service-translate-browse-path");

// subscription service
//xx registerObject("MonitoringMode");
registerObject("CreateSubscriptionRequest");
registerObject("CreateSubscriptionResponse");
registerObject("ModifySubscriptionRequest");
registerObject("ModifySubscriptionResponse");
registerObject("MonitoringParameters");
registerObject("MonitoredItemCreateRequest");
registerObject("MonitoredItemCreateResult");
registerObject("CreateMonitoredItemsRequest");
registerObject("CreateMonitoredItemsResponse");
registerObject("SubscriptionAcknowledgement");
registerObject("PublishRequest");
registerObject("NotificationMessage");
registerObject("PublishResponse");
registerObject("RepublishRequest");
registerObject("RepublishResponse");
registerObject("DeleteMonitoredItemsRequest");
registerObject("DeleteMonitoredItemsResponse");
registerObject("SetPublishingModeRequest");
registerObject("SetPublishingModeResponse");
registerObject("DeleteSubscriptionsRequest");
registerObject("DeleteSubscriptionsResponse");
registerObject("MonitoredItemNotification");
registerObject("DataChangeNotification");
registerObject("DataChangeFilter");
registerObject("MonitoredItemModifyRequest");
registerObject("MonitoredItemModifyResult");
registerObject("ModifyMonitoredItemsRequest");
registerObject("ModifyMonitoredItemsResponse");
registerObject("SetMonitoringModeRequest");
registerObject("SetMonitoringModeResponse");

registerObject("EventFieldList");
registerObject("EventNotificationList");
registerObject("StatusChangeNotification");
registerObject("SetTriggeringRequest");
registerObject("SetTriggeringResponse");
registerObject("TransferResult");
registerObject("TransferSubscriptionsRequest");
registerObject("TransferSubscriptionsResponse");





// Event results
registerObject("ContentFilterElementResult");
registerObject("ContentFilterResult");
registerObject("EventFilterResult");



//
registerObject("AggregateFilter");
