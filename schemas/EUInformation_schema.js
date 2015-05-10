"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var EUInformation_Schema = {
    name:"EUInformation",
    fields: [
        {   name:"NamespaceUri", fieldType:"String"        },
        {   name:"unitId",       fieldType:"Int32"         },
        {   name:"displayName",  fieldType:"LocalizedText" },
        {   name:"description",  fieldType:"LocalizedText" }
    ]
};
exports.EUInformation_Schema = EUInformation_Schema;
