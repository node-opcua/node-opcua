/**
 * @module opcua.datamodel
 */
var factories = require("./../misc/factories");


// see Part 3 $8.3 and Part 6 $5.2.213
var QualifiedName_Schema = {
    name: "QualifiedName",
    id: factories.next_available_id(),
    fields: [
        { name: "namespaceIndex", fieldType: "UInt16", documentation: "The namespace index" },
        { name: "name", fieldType: "String", defaultValue: function () {
            return null;
        }, documentation: "The name"            }
    ],

    toString: function () {
        return "ns=" + this.namespaceIndex + " name=" + this.name;
    }
};
exports.QualifiedName_Schema = QualifiedName_Schema;
exports.QualifiedName = factories.registerObject(QualifiedName_Schema);

function coerceQualifyName(value) {

    if (!value) {
        return null;
    }
    if (typeof value === "string") {
        return { namespaceIndex: 0, name: value};
    }
    assert(value.hasOwnProperty("namespaceIndex"));
    assert(value.hasOwnProperty("name"));
    return value;
}
exports.coerceQualifyName = coerceQualifyName;

