var ModifyMonitoredItemsResponse_Schema = {
    name: "ModifyMonitoredItemsResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        // MonitoredItemModifyResult
        // List of results for the MonitoredItems to modify. The size and order of the list
        // matches the size and order of the itemsToModify request parameter. This
        // structure is defined in-line with the following indented items.
        { name: "results", isArray: true, fieldType: "MonitoredItemModifyResult"     },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.ModifyMonitoredItemsResponse_Schema = ModifyMonitoredItemsResponse_Schema;
