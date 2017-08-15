"use strict";

var factories = require("node-opcua-factory");
var DataChangeTrigger_Schema = {
    name:"DataChangeTrigger",
    enumValues: {
        Status:                  0x00,
        StatusValue:             0x01,
        StatusValueTimestamp:    0x02,
        Invalid             :    -1,

    }
};
exports.DataChangeTrigger_Schema = DataChangeTrigger_Schema;
exports.DataChangeTrigger = factories.registerEnumeration(DataChangeTrigger_Schema);
