import {next_available_id} from "lib/misc/factories";

// see Part 3 $8.3 and Part 6 $5.2.213
const QualifiedName_Schema = {
    name: "QualifiedName",
    id: next_available_id(),
    fields: [
        { name: "namespaceIndex", fieldType: "UInt16", documentation: "The namespace index" },
        { name: "name", fieldType: "String", defaultValue: function () {
            return null;
        }, documentation: "The name"            }
    ]

};
export {QualifiedName_Schema};

