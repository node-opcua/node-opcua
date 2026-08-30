import * as factories from "node-opcua-factory";

export const ObjWithAccessLevel_Schema = {
    id: factories.next_available_id(),
    name: "ObjWithAccessLevel",
    fields: [
        { name: "title", fieldType: "String" },
        {
            name: "accessLevel",
            fieldType: "AccessLevelFlag"
        }
    ]
};
