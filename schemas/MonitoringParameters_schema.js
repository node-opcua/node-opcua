var MonitoringParameters_Schema = {
    name: "MonitoringParameters",
    fields: [
        { name: "clientHandle", fieldType: "IntegerId" },
        { name: "samplingInterval", fieldType: "Duration" },
        { name: "filter", fieldType: "ExtensibleParameterAdditionalHeader" },
        { name: "queueSize", fieldType: "Counter" },
        { name: "discardOldest", fieldType: "Boolean" }
    ]
};
exports.MonitoringParameters_Schema = MonitoringParameters_Schema;

