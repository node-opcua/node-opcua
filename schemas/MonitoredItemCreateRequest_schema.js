import {MonitoringMode} from "./MonitoringMode_enum";

const MonitoredItemCreateRequest_Schema = {
    name: "MonitoredItemCreateRequest",
    fields: [
        { name: "itemToMonitor", fieldType: "ReadValueId" },
        { name: "monitoringMode", fieldType: "MonitoringMode" },
        { name: "requestedParameters", fieldType: "MonitoringParameters" }
    ]
};
export {MonitoredItemCreateRequest_Schema};

