"use strict";
/**
 * @module opcua.datamodel
 */
require("requirish")._(module);

var factories = require("lib/misc/factories");

var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;

var d = require("lib/datamodel/diagnostic_info");
var s = require("lib/datamodel/structures");

var ec = require("lib/misc/encode_decode");
var assert = require("better-assert");
var _ = require("underscore");


var DataType = exports.DataType = require("schemas/DataType_enum").DataType;
var VariantArrayType = exports.VariantArrayType = require("schemas/VariantArrayType_enum").VariantArrayType;


var DiagnosticInfo = d.DiagnosticInfo;


function _self_encode(Type) {
    assert(_.isFunction(Type));
    return function (value, stream) {
        if (!value || !value.encode) {
            value = new Type(value);
        }
        value.encode(stream);
    };
}
function _self_decode(Type) {
    assert(_.isFunction(Type));

    return function (stream) {
        var value = new Type();
        value.decode(stream);
        return value;
    };
}


/**
 *
 * @class Variant
 *
 */
var Variant = exports.Variant = require("_generated_/_auto_generated_Variant").Variant;
exports.isValidVariant = require("schemas/Variant_schema").isValidVariant;

function _coerceVariant(variantLike) {
    var value =  (variantLike instanceof Variant) ? variantLike : new Variant(variantLike);
    assert(value instanceof Variant);
    return value;
}
Variant.coerce = _coerceVariant;


exports.registerSpecialVariantEncoder = function (ConstructorFunc) {

    assert(_.isFunction(ConstructorFunc));

    var name = ConstructorFunc.prototype._schema.name;

    factories.registerBuiltInType({
        name: name,
        encode: _self_encode(ConstructorFunc),
        decode: _self_decode(ConstructorFunc),
        defaultValue: null
    });

};

exports.registerSpecialVariantEncoder(QualifiedName);
exports.registerSpecialVariantEncoder(LocalizedText);
exports.registerSpecialVariantEncoder(Variant);
exports.registerSpecialVariantEncoder(DiagnosticInfo);
