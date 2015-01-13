// --------- This code has been automatically generated !!! Thu Jan 15 2015 23:57:31 GMT+0100 (CET)
var factories  = require("../lib/misc/factories");
var coerceNodeId = require("./../lib/datamodel/nodeid").coerceNodeId;
var ServerStatus_Schema = {
    id:  coerceNodeId('ns=0;i=864'),
    name: "ServerStatus",
    fields: [
       {
           name: "startTime",
           fieldType: "UtcTime"
       },
       {
           name: "currentTime",
           fieldType: "UtcTime"
       },
       {
           name: "state",
           fieldType: "ServerState"
       },
       {
           name: "buildInfo",
           fieldType: "BuildInfo"
       },
       {
           name: "secondsTillShutdown",
           fieldType: "UInt32"
       },
       {
           name: "shutdownReason",
           fieldType: "LocalizedText"
       },
        ]
    };
exports.ServerStatus_Schema = ServerStatus_Schema;