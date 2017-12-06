"use strict";
require("./ServerState_enum");
var RedundantServer_Schema = {
    id: "ns=0;i=855",
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
        }
    ]
};
exports.RedundantServer_Schema = RedundantServer_Schema;