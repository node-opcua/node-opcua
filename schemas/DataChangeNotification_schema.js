"use strict";
const DataChangeNotification_Schema = {
    name: "DataChangeNotification",
    //  BaseType="NotificationData"
    fields: [
        { name: "monitoredItems", isArray: true, fieldType: "MonitoredItemNotification" },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
export {DataChangeNotification_Schema};
