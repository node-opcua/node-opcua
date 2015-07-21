"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

// see Part 3 $8.3 and Part 6 $5.2.213
var QualifiedName_Schema = {
    name: "QualifiedName",
    id: factories.next_available_id(),
    fields: [
        { name: "namespaceIndex", fieldType: "UInt16", documentation: "The namespace index" },
        { name: "name", fieldType: "String", defaultValue: function () {
            return null;
        }, documentation: "The name"            }
    ]

};
exports.QualifiedName_Schema = QualifiedName_Schema;

