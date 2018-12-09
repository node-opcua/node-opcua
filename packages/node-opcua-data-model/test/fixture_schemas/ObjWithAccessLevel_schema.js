

const factories = require("node-opcua-factory");

const ObjWithAccessLevel_Schema = {

    id: factories.next_available_id(),
    name: "ObjWithAccessLevel",
    fields: [
        {name: "title", fieldType: "UAString"},
        {
            name: "accessLevel", fieldType: "AccessLevelFlag"
        }
    ]
};
exports.ObjWithAccessLevel_Schema = ObjWithAccessLevel_Schema;
