// --------- This code has been automatically generated !!! 2017-06-18T21:43:12.630Z
require("./ServerState_enum");
require("node-opcua-data-model");

var ServerStatus_Schema = {
    id: "ns=0;i=864",
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