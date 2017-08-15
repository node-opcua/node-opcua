var coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
var ModelChangeStructure_Schema = {
    id:  coerceNodeId("ns=0;i=879"),
    name: "ModelChangeStructure",
    fields: [
       {
           name: "affected",
           fieldType: "NodeId"
       },
       {
           name: "affectedType",
           fieldType: "NodeId"
       },
       {
           name: "verb",
           fieldType: "Byte"
       },
        ]
    };
exports.ModelChangeStructure_Schema = ModelChangeStructure_Schema;