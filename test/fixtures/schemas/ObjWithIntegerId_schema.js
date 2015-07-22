require("requirish")._(module);
var factories = require("lib/misc/factories");

var ObjWithIntegerId_Schema = {

    id: factories.next_available_id(),
    name: "ObjWithIntegerId",
    fields: [
        {name: "title", fieldType: "UAString"},
        {
            name: "requestHandle", fieldType: "IntegerId"
        }
    ]
};
exports.ObjWithIntegerId_Schema = ObjWithIntegerId_Schema;