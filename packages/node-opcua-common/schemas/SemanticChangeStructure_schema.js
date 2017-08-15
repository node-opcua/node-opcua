// --------- This code has been automatically generated !!! 2017-06-18T14:21:04.796Z
var factories  = require("node-opcua-factory");
var coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
var SemanticChangeStructure_Schema = {
    id:  coerceNodeId('ns=0;i=899'),
    name: "SemanticChangeStructure",
    fields: [
       {
           name: "affected",
           fieldType: "NodeId"
       },
       {
           name: "affectedType",
           fieldType: "NodeId"
       },
        ]
    };
exports.SemanticChangeStructure_Schema = SemanticChangeStructure_Schema;