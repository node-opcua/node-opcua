
var factories = require("./factories");

var BuildInfo_Schema = {
    name:"BuildInfo",
    documentation:'Server build Info',

    fields: [
        { name: "productUri" ,       fieldType: "String"},
        { name: "manufacturerName" , fieldType: "String"},
        { name: "productName" ,      fieldType: "String"},
        { name: "softwareVersion" ,  fieldType: "String"},
        { name: "buildNumber" ,      fieldType: "String"},
        { name: "buildDate" ,        fieldType: "UtcTime"}
    ]
};
exports.BuildInfo = factories.registerObject(BuildInfo_Schema);

