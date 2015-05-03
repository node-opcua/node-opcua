var factories= require("../lib/misc/factories");
var Range_Schema = {
    name:"Range",
    fields: [
        { name: "low",        fieldType: "Double" },
        { name: "high",        fieldType: "Double" }
    ]
};
exports.Range_Schema = Range_Schema;