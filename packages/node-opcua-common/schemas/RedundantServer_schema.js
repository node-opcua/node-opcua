"use strict";
require("./ServerState_enum");
var coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
var RedundantServer_Schema = {
    id:  coerceNodeId("ns=0;i=855"),
    name: "RedundantServer",
    fields: [
       {
           name: "serverId",
           fieldType: "String"
       },
       {
           name: "serviceLevel",
           fieldType: "Byte"
       },
       {
           name: "serverState",
           fieldType: "ServerState"
       },
        ]
    };
exports.RedundantServer_Schema = RedundantServer_Schema;