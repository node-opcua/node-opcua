"use strict";

require("./DataChangeTrigger_enum");
require("./DeadbandType_enum");

var DataChangeFilter_Schema = {
    name: "DataChangeFilter",
    //  BaseType="MonitoringFilter"
    fields: [
        { name:"trigger"      ,fieldType:"DataChangeTrigger"},
        { name:"deadbandType" ,fieldType:"DeadbandType" },
        { name:"deadbandValue",fieldType:"Double" }
    ]
};
exports.DataChangeFilter_Schema = DataChangeFilter_Schema;
