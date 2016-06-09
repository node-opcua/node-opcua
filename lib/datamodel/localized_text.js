"use strict";
/**
 * @module opcua.datamodel
 */
require("requirish")._(module);
var assert = require("better-assert");

var LocalizedText = require("_generated_/_auto_generated_LocalizedText").LocalizedText;
exports.LocalizedText = LocalizedText;

function coerceLocalizedText(value) {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value === "string") {
        return new LocalizedText({locale: null, text: value});
    }
    if (value instanceof LocalizedText) {
        return value;
    }
    assert(value.hasOwnProperty("locale"));
    assert(value.hasOwnProperty("text"));
    return new LocalizedText(value);
}
exports.coerceLocalizedText = coerceLocalizedText;

