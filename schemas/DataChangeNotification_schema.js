"use strict";
var DataChangeNotification_Schema = {
    name: "DataChangeNotification",
    //  BaseType="NotificationData"
    fields: [
        { name: "monitoredItems", isArray: true, fieldType: "MonitoredItemNotification" },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.DataChangeNotification_Schema = DataChangeNotification_Schema;
