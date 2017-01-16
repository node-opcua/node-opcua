/**
 * @module opcua.datamodel
 */
require("requirish")._(module);

const factories = require("lib/misc/factories");

const QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;
const LocalizedText = require("lib/datamodel/localized_text").LocalizedText;

const d = require("lib/datamodel/diagnostic_info");
const s = require("lib/datamodel/structures");

const ec = require("lib/misc/encode_decode");
const assert = require("better-assert");
const _ = require("underscore");


const DataType = exports.DataType = require("schemas/DataType_enum").DataType;
const VariantArrayType = exports.VariantArrayType = require("schemas/VariantArrayType_enum").VariantArrayType;


const DiagnosticInfo = d.DiagnosticInfo;


function _self_encode(Type) {
    assert(_.isFunction(Type));
    return (value, stream) => {
        if (!value || !value.encode) {
            value = new Type(value);
        }
        value.encode(stream);
    };
}
function _self_decode(Type) {
    assert(_.isFunction(Type));

    return stream => {
        const value = new Type();
        value.decode(stream);
        return value;
    };
}


/**
 *
 * @class Variant
 *
 */
const Variant = exports.Variant = require("_generated_/_auto_generated_Variant").Variant;
exports.isValidVariant = require("schemas/Variant_schema").isValidVariant;

function _coerceVariant(variantLike) {
    const value =  (variantLike instanceof Variant) ? variantLike : new Variant(variantLike);
    assert(value instanceof Variant);
    return value;
}
Variant.coerce = _coerceVariant;


exports.registerSpecialVariantEncoder = ConstructorFunc => {

    assert(_.isFunction(ConstructorFunc));

    const name = ConstructorFunc.prototype._schema.name;

    factories.registerBuiltInType({
        name,
        encode: _self_encode(ConstructorFunc),
        decode: _self_decode(ConstructorFunc),
        defaultValue: null
    });

};

exports.registerSpecialVariantEncoder(QualifiedName);
exports.registerSpecialVariantEncoder(LocalizedText);
exports.registerSpecialVariantEncoder(Variant);
exports.registerSpecialVariantEncoder(DiagnosticInfo);
