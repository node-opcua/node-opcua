"use strict";
/**
 * @module opcua.datamodel
 */

var assert = require("node-opcua-assert");

var LocalizedText = require("../_generated_/_auto_generated_LocalizedText").LocalizedText;
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
LocalizedText.coerce = coerceLocalizedText;
exports.coerceLocalizedText = coerceLocalizedText;

var factory = require("node-opcua-factory");
factory.registerSpecialVariantEncoder(exports.LocalizedText);
