
"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var BuildInfo_Schema = {
    name:"BuildInfo",
    documentation:'Server build Info',

    fields: [
        { name: "productUri" ,       fieldType: "String" , documentation: "A description for the ProductUri Variable."},
        { name: "manufacturerName" , fieldType: "String" , documentation: "the name of the manufacturer"},
        { name: "productName" ,      fieldType: "String" , documentation: "the product name"},
        { name: "softwareVersion" ,  fieldType: "String" , documentation: "the software version"},
        { name: "buildNumber" ,      fieldType: "String" , documentation: "the software build number"},
        { name: "buildDate" ,        fieldType: "UtcTime", documentation: "the software build date"}
    ]
};
exports.BuildInfo_Schema = BuildInfo_Schema;