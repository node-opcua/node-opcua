"use strict";
/**
 * @module opcua.datamodel
 */
const assert = require("node-opcua-assert").assert;

const QualifiedName = require("node-opcua-data-model").QualifiedName;
const LocalizedText = require("node-opcua-data-model").LocalizedText;
const DiagnosticInfo = require("node-opcua-data-model").DiagnosticInfo;
const DataType = exports.DataType = require("../schemas/DataType_enum").DataType;
const VariantArrayType = exports.VariantArrayType = require("../schemas/VariantArrayType_enum").VariantArrayType;



/**
 *
 * @class Variant
 *
 */
const Variant = exports.Variant = require("../_generated_/_auto_generated_Variant").Variant;
exports.isValidVariant = require("../schemas/Variant_schema").isValidVariant;
Variant.isValidVariant = exports.isValidVariant;

function _coerceVariant(variantLike) {
    const value =  (variantLike instanceof Variant) ? variantLike : new Variant(variantLike);
    assert(value instanceof Variant);
    return value;
}
Variant.coerce = _coerceVariant;

/**
 * @method clone
 *   deep clone a variant
 *
 * @return {exports.Variant}
 */
Variant.prototype.clone = function () {
    return new this.constructor(this);
};



const factory = require("node-opcua-factory");
factory.registerSpecialVariantEncoder(Variant);
