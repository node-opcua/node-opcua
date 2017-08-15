var coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
var ServiceCounter_Schema = {
    id:  coerceNodeId("ns=0;i=873"),
    name: "ServiceCounter",
    fields: [
       {
           name: "totalCount",
           fieldType: "UInt32"
       },
       {
           name: "errorCount",
           fieldType: "UInt32"
       },
        ]
    };
exports.ServiceCounter_Schema = ServiceCounter_Schema;