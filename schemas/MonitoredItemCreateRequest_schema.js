var MonitoringMode = require("./MonitoringMode_enum").MonitoringMode;

var MonitoredItemCreateRequest_Schema = {
    name: "MonitoredItemCreateRequest",
    fields: [
        { name: "itemToMonitor", fieldType: "ReadValueId" },
        { name: "monitoringMode", fieldType: "MonitoringMode" },
        { name: "requestedParameters", fieldType: "MonitoringParameters" }
    ]
};
exports.MonitoredItemCreateRequest_Schema = MonitoredItemCreateRequest_Schema;

