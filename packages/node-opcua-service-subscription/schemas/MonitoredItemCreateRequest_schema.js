const MonitoringMode = require("./MonitoringMode_enum").MonitoringMode;

require("node-opcua-service-read"); // for ReadValueId

const MonitoredItemCreateRequest_Schema = {
    name: "MonitoredItemCreateRequest",
    fields: [
        { name: "itemToMonitor", fieldType: "ReadValueId" },
        { name: "monitoringMode", fieldType: "MonitoringMode" },
        { name: "requestedParameters", fieldType: "MonitoringParameters" }
    ]
};
exports.MonitoredItemCreateRequest_Schema = MonitoredItemCreateRequest_Schema;

