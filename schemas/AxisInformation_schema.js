"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var AxisScale = require("schemas/AxisScale_enum").AxisScale;

var AxisInformation_Schema = {
    name:"AxisInformation",
    id: factories.next_available_id(),
    fields: [
        { name: "engineeringUnits",        fieldType: "EUInformation" },
        { name: "EURange",                 fieldType: "Range" },
        { name: "title",                   fieldType: "LocalizedText" },
        { name: "axisScaleType",           fieldType: "AxisScaleEnumeration" },
        { name: "axisSteps", isArray:true, fieldType: "Double" }
    ]
};
exports.AxisInformation_Schema =AxisInformation_Schema;