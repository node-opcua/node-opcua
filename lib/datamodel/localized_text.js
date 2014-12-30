/**
 * @module opcua.datamodel
 */
require("requirish")._(module);
var assert = require("better-assert");

function coerceLocalizedText(value) {
    if (typeof value === "string") {
        return { locale: null, text: value};
    }
    assert(value.hasOwnProperty("locale"));
    assert(value.hasOwnProperty("text"));
    return value;
}
exports.coerceLocalizedText = coerceLocalizedText;

exports.LocalizedText = require("_generated_/_auto_generated_LocalizedText").LocalizedText;
