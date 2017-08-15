// --------- This code has been automatically generated !!! 2017-06-18T14:21:04.808Z
var factories  = require("node-opcua-factory");
var coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
var SamplingIntervalDiagnostics_Schema = {
    id:  coerceNodeId('ns=0;i=858'),
    name: "SamplingIntervalDiagnostics",
    fields: [
       {
           name: "samplingInterval",
           fieldType: "Duration"
       },
       {
           name: "monitoredItemCount",
           fieldType: "UInt32"
       },
       {
           name: "maxMonitoredItemCount",
           fieldType: "UInt32"
       },
       {
           name: "disabledMonitoredItemCount",
           fieldType: "UInt32"
       },
        ]
    };
exports.SamplingIntervalDiagnostics_Schema = SamplingIntervalDiagnostics_Schema;