"use strict";
/**
 * @module opcua.datamodel
 */
var assert = require("better-assert");

var QualifiedName = require("node-opcua-data-model").QualifiedName;
var LocalizedText = require("node-opcua-data-model").LocalizedText;
var DiagnosticInfo = require("node-opcua-data-model").DiagnosticInfo;
var DataType = exports.DataType = require("../schemas/DataType_enum").DataType;
var VariantArrayType = exports.VariantArrayType = require("../schemas/VariantArrayType_enum").VariantArrayType;



/**
 *
 * @class Variant
 *
 */
var Variant = exports.Variant = require("../_generated_/_auto_generated_Variant").Variant;
exports.isValidVariant = require("../schemas/Variant_schema").isValidVariant;

function _coerceVariant(variantLike) {
    var value =  (variantLike instanceof Variant) ? variantLike : new Variant(variantLike);
    assert(value instanceof Variant);
    return value;
}
Variant.coerce = _coerceVariant;


var factory = require("node-opcua-factory");
factory.registerSpecialVariantEncoder(Variant);
