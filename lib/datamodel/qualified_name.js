/**
 * @module opcua.datamodel
 */
var factories = require("./../misc/factories");
var assert = require("better-assert");
exports.QualifiedName = require("../../_generated_/_auto_generated_QualifiedName").QualifiedName;


function coerceQualifyName(value) {

    if (!value) {
        return null;
    }
    if (typeof value === "string") {
        return new exports.QualifiedName({ namespaceIndex: 0, name: value});
    }
    assert(value.hasOwnProperty("namespaceIndex"));
    assert(value.hasOwnProperty("name"));
    return new exports.QualifiedName(value);
}
exports.coerceQualifyName = coerceQualifyName;

